/**
 * Codex-shaped `update_plan` over the DSH todo projection.
 *
 * Codex models are trained with `update_plan`; the native DSH tool is
 * `todo_write` and its name is hard-coded, so this plugin registers the Codex
 * name and schema while writing the same `todos` projection that the DSH Web
 * UI and session replay already understand.
 */
import { isRecord } from './guards.ts'
import type { PlanContext, TodoItem, TodoList, TodoStatus } from './types.js'

/** Diagnostic plugin name. */
export const name = 'tool-update-plan'

/** The projection and tool registries this plugin writes to. */
export const inject = ['tools', 'sessionProjections']

/** The three statuses shared by Codex's plan schema and the DSH todo item. */
const STATUSES = ['pending', 'in_progress', 'completed'] as const

/** Exact Codex success text (`plan.rs`, `PLAN_UPDATED_MESSAGE`). */
const PLAN_UPDATED_MESSAGE = 'Plan updated'

/** Model-supplied arguments, validated below before use. */
interface UpdatePlanArgs {
  explanation?: unknown
  plan?: unknown
}

/** True when a model-supplied status is one of Codex's three strings. */
function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
}

/**
 * Runtime schema for the `todos` projection. `dsh-tool-todo` validates the same
 * shape with Zod; this adapter cannot import that package's schema without
 * taking a dependency on an unexported module, so it validates the two fields
 * the projection actually stores. The two branches mirror the native unit:
 * `null` before the first write, otherwise a whole todo list.
 */
const TODO_LIST_SCHEMA: { parse(value: unknown): TodoList | null } = {
  parse(value: unknown): TodoList | null {
    if (value === null) return null
    if (!Array.isArray(value)) throw new Error('todos projection must be an array or null')
    return value.map((todo: unknown): TodoItem => {
      if (!isRecord(todo) || typeof todo.content !== 'string' || !isTodoStatus(todo.status)) {
        throw new Error('todos projection contains an invalid item')
      }
      return { content: todo.content, status: todo.status }
    })
  },
}

/**
 * Map Codex `{ step, status }` items onto DSH `{ content, status }` items.
 *
 * The DSH panel stores a flat list of `TodoItem` objects. Codex names the text
 * `step` and uses the identical three status strings, so the mapping is only a
 * field rename. Codex's optional `explanation` has no slot in the todo
 * projection; it is accepted for schema compatibility and otherwise ignored.
 *
 * Codex's description asks for at most one `in_progress` step but its handler
 * accepts any list, and the todo projection stores any list too, so this
 * adapter does not enforce the rule either.
 *
 * @returns the canonical todo list to persist.
 */
function toTodoList(args: UpdatePlanArgs): TodoList {
  if (args.explanation !== undefined && typeof args.explanation !== 'string') {
    throw new Error('update_plan: explanation must be a string')
  }
  if (!Array.isArray(args.plan)) throw new Error('update_plan: plan must be an array')

  return args.plan.map((item: unknown, index: number): TodoItem => {
    if (!isRecord(item) || typeof item.step !== 'string' || !isTodoStatus(item.status)) {
      throw new Error(`update_plan: invalid plan item at index ${index}`)
    }
    return { content: item.step, status: item.status }
  })
}

/**
 * Register the `todos` projection and the `update_plan` tool.
 *
 * The projection uses the native key and `stateVersion` so the registry shares
 * one unit when `dsh-tool-todo` is mounted too (registrants of a key are
 * reference-counted). When that plugin is removed from the preset, this
 * registration keeps the Web UI's todo panel working on its own.
 *
 * @param ctx - registrant context carrying the tool and projection registries.
 */
export async function apply(ctx: PlanContext): Promise<void> {
  await ctx.sessionProjections.register<'todos', TodoList | null>({
    key: 'todos',
    stateSchema: TODO_LIST_SCHEMA,
    init: () => null,
    apply: (state, event) => {
      if (event.type === 'todo/write') return event.data.todos
      if (event.type === 'turn/start') return null
      return state
    },
    wire: {
      viewSchema: TODO_LIST_SCHEMA,
      view: (state) => state,
      summary: false,
    },
    stateVersion: 2,
  })

  ctx.tools.register<UpdatePlanArgs, string>({
    name: 'update_plan',
    description: 'Updates the task plan.\nProvide an optional explanation and a list of plan items, each with a step and status.\nAt most one step can be in_progress at a time.\n',
    parameters: {
      type: 'object',
      properties: {
        explanation: {
          type: 'string',
          description: 'Optional explanation for this plan update.',
        },
        plan: {
          type: 'array',
          description: 'The list of steps',
          items: {
            type: 'object',
            properties: {
              step: {
                type: 'string',
                description: 'Task step text.',
              },
              status: {
                type: 'string',
                enum: STATUSES,
                description: 'Step status.',
              },
            },
            required: ['step', 'status'],
            additionalProperties: false,
          },
        },
      },
      required: ['plan'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
    },
    async execute(args: UpdatePlanArgs, exec): Promise<string> {
      if (!isRecord(args)) throw new Error('update_plan: arguments must be an object')
      const todos = toTodoList(args)
      if (exec.agent === undefined) throw new Error('update_plan requires an owning agent session')
      exec.agent.session.append('todo/write', { todos })
      return PLAN_UPDATED_MESSAGE
    },
  })
}
