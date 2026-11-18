/**
 * Codex-shaped `view_image` over the native DSH image path.
 *
 * `dsh-tool-fs` exports only its plugin entry, so its reusable `read_image`
 * helpers are not reachable through the package boundary. This tool therefore
 * repeats the native path: resolve and stat through `ctx.fs`, read with the
 * deployment's byte cap, then commit through `ctx.attachments.saveImage`. The
 * service order, permission checks and limits are the native ones; only the
 * tool name and the Codex `path` parameter differ.
 *
 * The result is the native structured value `{ path, image }`, and the renderer
 * emits the same text envelope plus an image block, so the model receives an
 * attachment rather than a base64 payload.
 */

import { basename, extname } from 'node:path'
import { isRecord } from './guards.ts'
import type {
  AttachmentRef,
  AttachmentStore,
  FsInfo,
  FsTarget,
  ImageContext,
  JsonSchema,
  ToolExecution,
  ViewImageResult,
} from './types.js'

/** Diagnostic plugin name. */
export const name = 'tool-view-image'

/** Services needed for the native filesystem, attachment and route checks. */
export const inject = ['tools', 'fs', 'attachments', 'workingDirectory']

/** Extensions the native image reader accepts; the store still verifies the bytes. */
const IMAGE_EXTENSIONS: Readonly<Record<string, string | undefined>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const JPEG_SIGNATURE = [255, 216, 255]

/** Structured image metadata carried to the renderer and the attachment block. */
const IMAGE_VALUE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'],
  properties: {
    attachmentId: { type: 'string' },
    mediaType: {
      type: 'string',
      enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    },
    bytes: { type: 'integer' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    name: { type: 'string' },
    originalDimensions: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height'],
      properties: {
        width: { type: 'integer' },
        height: { type: 'integer' },
      },
    },
  },
}

/** Model-supplied arguments, validated before use. */
interface ViewImageArgs {
  path?: unknown
}

/** Compare bytes at an offset without copying the file into a larger buffer. */
function matchesBytes(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (data.byteLength < offset + expected.length) return false
  return expected.every((byte, index) => data[offset + index] === byte)
}

/** Compare ASCII at an offset for the GIF and WebP signatures. */
function matchesAscii(data: Uint8Array, offset: number, value: string): boolean {
  if (data.byteLength < offset + value.length) return false
  for (let index = 0; index < value.length; index += 1) {
    if (data[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

/**
 * Identify a supported image from its file signature, as the native reader
 * does for extension-less paths. The attachment store's decode stays
 * authoritative.
 * @returns the detected media type, or undefined for other bytes.
 */
function sniffImageMediaType(data: Uint8Array): string | undefined {
  if (matchesBytes(data, 0, PNG_SIGNATURE)) return 'image/png'
  if (matchesBytes(data, 0, JPEG_SIGNATURE)) return 'image/jpeg'
  if (matchesAscii(data, 0, 'GIF87a') || matchesAscii(data, 0, 'GIF89a')) return 'image/gif'
  if (matchesAscii(data, 0, 'RIFF') && matchesAscii(data, 8, 'WEBP')) return 'image/webp'
}

/**
 * Refuse a media type the deployment's attachment policy does not accept.
 * @param attachments - mounted attachment store.
 * @param mediaType - declared or sniffed media type.
 * @param displayPath - resolved path shown to the model.
 */
function assertDeploymentAccepts(attachments: AttachmentStore, mediaType: string, displayPath: string): void {
  if (!attachments.imageLimits.mediaTypes.includes(mediaType)) {
    throw new Error(`cannot view "${displayPath}": ${mediaType} images are not accepted by this deployment`)
  }
}

/**
 * Reject a model route that cannot inspect images, matching the native
 * `read_image` gate. A model without image input would only receive a
 * placeholder text block, so failing before the filesystem work is clearer.
 * @param ctx - plugin context supplying the optional `llm` service.
 * @param exec - current tool execution, including the owning Agent.
 * @param requestedPath - raw path shown in the refusal.
 */
async function assertImageCapableRoute(ctx: ImageContext, exec: ToolExecution, requestedPath: string): Promise<void> {
  const routed = exec.agent?.session.requestHeader()?.config
  const provider = routed?.provider ?? exec.agent?.options.provider
  const model = routed?.model ?? exec.agent?.options.model
  const llm = ctx.get('llm')
  if (provider === undefined || model === undefined || llm === undefined) {
    throw new Error(`cannot view "${requestedPath}" as an image: the current model route could not be resolved`)
  }
  const active = await llm.resolveModelInfo(provider, model, exec.signal)
  if (active.inputModalities === undefined || !active.inputModalities.includes('image')) {
    throw new Error('view_image is not allowed because you do not support image inputs')
  }
}

/**
 * Resolve a model path against the session directory and require a regular
 * file, emitting the same absence observation as the native reader.
 * @param requestedPath - raw model-supplied path.
 * @returns the resolved target and its stat result.
 */
async function resolveRegularReadTarget(
  ctx: ImageContext,
  exec: ToolExecution,
  requestedPath: string,
): Promise<{ target: FsTarget; info: FsInfo }> {
  const cwd = exec.agent === undefined ? undefined : await ctx.workingDirectory.ensure(exec.agent, exec.signal)
  const target = await ctx.fs.resolve(requestedPath, {
    ...(cwd === undefined ? {} : { cwd }),
    signal: exec.signal,
  })
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) {
    ctx.emit('fs/observed', target, { kind: 'absent' }, exec)
    throw new Error(`cannot view "${target.displayPath}": not found`)
  }
  if (info.type !== 'file') throw new Error(`cannot view "${target.displayPath}": not a regular file`)
  return { target, info }
}

/**
 * Translate the attachment store's stable failure codes into the native
 * reader's actionable messages. Unknown errors and unhandled codes are
 * returned as undefined so the caller rethrows the original error.
 * @param error - rejection from `attachments.saveImage`.
 * @param attachments - store whose limits appear in messages.
 * @param displayPath - resolved path shown to the model.
 * @param mediaType - declared or sniffed media type.
 * @param declared - extension-declared type, or undefined when the path had no image extension.
 * @param extension - lowercase path extension used in mismatch messages.
 * @returns the model-facing replacement error, or undefined to rethrow.
 */
function mapAttachmentError(
  error: unknown,
  attachments: AttachmentStore,
  displayPath: string,
  mediaType: string,
  declared: string | undefined,
  extension: string,
): Error | undefined {
  const limits = attachments.imageLimits
  const code = isRecord(error) ? error.code : undefined
  switch (code) {
    case 'IMAGE_DIMENSION_TOO_LARGE':
      return new Error(`cannot view "${displayPath}": at least one image side exceeds the ${limits.maxImageDimension}px limit; downscale the image and view the smaller copy`, { cause: error })
    case 'IMAGE_TOO_MANY_PIXELS':
      return new Error(`cannot view "${displayPath}": the image exceeds the ${limits.maxImagePixels}-pixel decoded-size limit; downscale the image and view the smaller copy`, { cause: error })
    case 'IMAGE_TOO_LARGE':
    case 'IMAGES_TOO_LARGE':
      return new Error(`cannot view "${displayPath}": the image cannot be stored within the deployment's byte limits; downscale the image and view the smaller copy`, { cause: error })
    case 'UNSUPPORTED_IMAGE_TYPE':
      return new Error(`cannot view "${displayPath}": ${mediaType} images are not accepted by this deployment`, { cause: error })
    case 'ATTACHMENT_WRITE_FAILED':
      if (/16-bit PNG/iu.test(String(isRecord(error) ? error.message : undefined))) {
        return new Error(`cannot view "${displayPath}": the 16-bit PNG could not be converted to the normalized 8-bit sRGB form; convert it to an 8-bit PNG/JPEG/WebP and retry`, { cause: error })
      }
      return undefined
    case 'INVALID_IMAGE':
      return new Error(`cannot view "${displayPath}": the file content is not a supported image format; view_image accepts PNG/JPEG/WebP/GIF, and the bytes may be truncated or corrupt`, { cause: error })
    case 'IMAGE_TYPE_MISMATCH':
      if (declared === undefined) {
        return new Error(`cannot view "${displayPath}": the file signature claims ${mediaType}, but the bytes decode as a different image format; the file may be corrupt`, { cause: error })
      }
      return new Error(`cannot view "${displayPath}": the ${extension} extension declares ${mediaType}, but the bytes use a different image format; rename the file to match its actual format if it is PNG/JPEG/WebP/GIF, or convert it to one of those formats`, { cause: error })
    default:
      return undefined
  }
}

/**
 * Build the attachment reference carried by the image content block.
 * @param image - validated image metadata from the tool result.
 * @returns the durable reference the model request layer consumes.
 */
function imageRefFromValue(image: AttachmentRef): AttachmentRef {
  return {
    attachmentId: image.attachmentId,
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...(image.name === undefined ? {} : { name: image.name }),
    ...(image.originalDimensions === undefined ? {} : { originalDimensions: { ...image.originalDimensions } }),
  }
}

/**
 * Format the text envelope beside the image block, including the scale factor
 * when the attachment store reduced the image.
 * @param displayPath - canonical path in the filesystem execution world.
 * @param image - image metadata.
 * @returns the model-facing text block.
 */
function formatImageReadOutput(displayPath: string, image: AttachmentRef): string {
  let scaled = ''
  if (image.originalDimensions !== undefined) {
    const x = (image.originalDimensions.width / image.width).toFixed(2)
    const y = (image.originalDimensions.height / image.height).toFixed(2)
    const advice = x === y ? `multiply coordinates by ${x}` : `multiply x coordinates by ${x} and y coordinates by ${y}`
    scaled = ` (downscaled from ${image.originalDimensions.width}x${image.originalDimensions.height} px; ${advice} to locate features in the original file)`
  }
  return `<path>${displayPath}</path>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes${scaled}
</content>`
}

/**
 * Register the `view_image` tool.
 * @param ctx - registrant context carrying the tools and image services.
 */
export function apply(ctx: ImageContext): void {
  ctx.tools.register<ViewImageArgs, ViewImageResult>({
    name: 'view_image',
    description: 'View a local image file from the filesystem when visual inspection is needed. Use this for images already available on disk.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Local filesystem path to an image file.',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'image'],
        properties: {
          path: { type: 'string' },
          image: IMAGE_VALUE_SCHEMA,
        },
      },
      render: (_args: unknown, value: ViewImageResult) => [
        { type: 'text', text: formatImageReadOutput(value.path, value.image) },
        { type: 'image', attachment: imageRefFromValue(value.image) },
      ],
    },
    isConcurrencySafe: () => true,
    async execute(args: ViewImageArgs, exec): Promise<ViewImageResult> {
      if (typeof args?.path !== 'string' || args.path.trim().length === 0) {
        throw new Error('path must be a non-empty string')
      }

      const extension = extname(args.path).toLowerCase()
      const declared = IMAGE_EXTENSIONS[extension]
      if (declared === undefined && extension !== '') {
        throw new Error(`cannot view "${args.path}": the ${extension} extension does not declare a supported image format; view_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`)
      }

      const attachments = ctx.attachments
      if (declared !== undefined) assertDeploymentAccepts(attachments, declared, args.path)
      await assertImageCapableRoute(ctx, exec, args.path)

      const { target, info } = await resolveRegularReadTarget(ctx, exec, args.path)
      const byteCap = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes)
      const data = await ctx.fs.readBytes(target, exec.signal, byteCap)
      const mediaType = declared ?? sniffImageMediaType(data)
      if (mediaType === undefined) {
        throw new Error(`cannot view "${target.displayPath}": the file content is not a supported image format; view_image accepts PNG/JPEG/WebP/GIF`)
      }
      if (declared === undefined) assertDeploymentAccepts(attachments, mediaType, target.displayPath)

      let ref: AttachmentRef
      try {
        ref = await attachments.saveImage({
          data,
          mediaType,
          name: basename(target.displayPath),
        })
      } catch (error) {
        throw mapAttachmentError(error, attachments, target.displayPath, mediaType, declared, extension) ?? error
      }

      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      return {
        path: ctx.fs.processPath(target),
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...(ref.name === undefined ? {} : { name: ref.name }),
          ...(ref.originalDimensions === undefined ? {} : { originalDimensions: { ...ref.originalDimensions } }),
        },
      }
    },
  })
}
