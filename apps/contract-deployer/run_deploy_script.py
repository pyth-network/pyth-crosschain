import os
from pathlib import Path
import subprocess

import streamlit as st


def get_1pw_deployer_private_key():
    return "000"


def build_deploy_command(chain_name):
    return f"./deploy.sh {chain_name}"


def run_deploy_script(chain_name: str, repo_base_dir: Path):
    # Create a placeholder for the output

    with st.expander("Deployment logs", expanded=True):
        script_logs_div = st.code("")

    script_logs = ""
    env = os.environ.copy()
    env.update({"PK": get_1pw_deployer_private_key()})
    deploy_command = build_deploy_command(chain_name)
    process = subprocess.Popen(
        [
            "bash",
            "-c",
            deploy_command,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True,
        cwd=(repo_base_dir.joinpath("target_chains/ethereum/contracts")).as_posix(),
        env=env,
    )

    script_logs += f"Started deploying in process {process.pid}\n"

    # Stream output
    while True:
        output = process.stdout.readline()
        error = process.stderr.readline()
        if output:
            script_logs += output.strip() + "\n"
        if error:
            script_logs += error.strip() + "\n"

        script_logs_div.code(script_logs)

        # Check if process has finished
        if process.poll() is not None:
            # Dump any remaining output
            remaining_output, remaining_error = process.communicate()
            if remaining_output:
                script_logs += remaining_output.strip() + "\n"
            if remaining_error:
                script_logs += remaining_error.strip() + "\n"
            script_logs_div.code(script_logs)
            break

    # Get the return code
    if process.returncode == 0:
        st.success("Deployment script executed successfully!")
    else:
        st.error("Deployment script failed!")
