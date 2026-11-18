# atlas service

A small internal service. Configuration is created by the setup wizard, not by
checking in a file by hand.

```sh
python3 scripts/wizard.py
```

The wizard asks for the project name, the region and whether metrics are
enabled. It writes `config/project.toml` and generates a random install id.
The install id identifies this deployment, so it must come from the wizard.

Do not edit `scripts/wizard.py` for a single setup run.
