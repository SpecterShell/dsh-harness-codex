# Rubric: 05-setup-wizard

1. **Used the wizard.** The transcript shows the wizard process being started
   and the three prompts being answered, whether through a terminal or piped
   stdin. The agent did not hand-write `config/project.toml`.
2. **Answers are right.** Name `atlas`, region `eu-west-2`, metrics enabled, and
   a wizard-generated install id.
3. **Handled interaction cleanly.** If the first attempt produced the wrong
   values or blocked on a prompt, the agent recovered without leaving a broken
   process behind.
4. **Verified.** The agent read back the generated file or otherwise checked the
   values, and its report matches what happened.
