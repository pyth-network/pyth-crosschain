from urllib.parse import urlparse
import streamlit as st

from run_deploy_script import run_deploy_script
from git_ops import GitOps
from update_files import update_files
import os

GITHUB_REPO = "pyth-network/pyth-crosschain"
GITHUB_COMMITER_NAME = "contract-deployer"
GITHUB_COMMITER_EMAIL = "contract-deployer@pyth.network"

EVM_CHAINS_YAML = "contract_manager/store/chains/EvmChains.yaml"
RECEIVER_CHAINS_JSON = (
    "governance/xc_admin/packages/xc_admin_common/src/receiver_chains.json"
)


def validate_inputs(chain_name: str, rpc_url: str) -> bool:
    if not chain_name:
        st.error("Chain name cannot be empty")
        return False

    if not rpc_url:
        st.error("RPC URL cannot be empty")
        return False

    # Validate URL format
    try:
        result = urlparse(rpc_url)
        if not all([result.scheme in ("http", "https"), result.netloc]):
            st.error("Invalid RPC URL format. Please enter a valid HTTP/HTTPS URL")
            return False
    except:
        st.error("Invalid URL format")
        return False

    return True


def main():

    st.header("EVM Contract Deployer")

    with st.form("deploy_config", enter_to_submit=False):
        chain_name = st.text_input("Chain Name", placeholder="e.g. Ethereum, Sepolia")
        rpc_url = st.text_input("RPC URL", placeholder="https://...")
        is_mainnet = st.checkbox("Is Mainnet?", value=False)
        submitted = st.form_submit_button("🚀 Deploy Contracts and Generate PR")

    if submitted:
        try:
            if not validate_inputs(chain_name, rpc_url):
                return

            token = os.environ.get("GITHUB_TOKEN")
            repo_name = os.environ.get("GITHUB_REPO", GITHUB_REPO)
            branch_name = os.environ["GIT_BRANCH"]
            commiter_name = os.environ.get("GITHUB_COMMITER_NAME", GITHUB_COMMITER_NAME)
            commiter_email = os.environ.get(
                "GITHUB_COMMITER_EMAIL", GITHUB_COMMITER_EMAIL
            )

            st.write(f"Cloning the repository. Using branch {branch_name}.")
            with GitOps(
                token, repo_name, commiter_name, commiter_email, branch_name=branch_name
            ) as git_ops:
                evm_chains_path = os.path.join(
                    git_ops.get_checkout_path(), EVM_CHAINS_YAML
                )
                receiver_chains_path = os.path.join(
                    git_ops.get_checkout_path(), RECEIVER_CHAINS_JSON
                )
                update_files(
                    evm_chains_path,
                    receiver_chains_path,
                    is_mainnet,
                    chain_name,
                    rpc_url,
                )

                # diff = git_ops.get_diff()
                # if diff:
                #     st.write(diff)
                # else:
                #     return None

                run_deploy_script(chain_name, repo_base_dir=git_ops.get_checkout_path())
                git_ops.commit_and_push(f"Deploy {chain_name} to {rpc_url}")
                pr = git_ops.create_pull_request(f"Deploy {chain_name} to {rpc_url}")
                st.write(f"Created pull request <a href={pr.url}>{pr.url}</a>")

        except Exception as e:
            st.error(f"An unexpected error occurred: {repr(e)}")
            raise


if __name__ == "__main__":
    # Enable running the app without `streamlit run`
    # https://github.com/streamlit/streamlit/issues/9450#issuecomment-2386348596
    if "__streamlitmagic__" not in locals():
        import streamlit.web.bootstrap

        streamlit.web.bootstrap.run(__file__, False, [], {})
    main()
