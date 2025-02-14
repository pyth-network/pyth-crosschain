from pathlib import Path
import tempfile
import os
import logging
import shutil

import pygit2
from github import Auth
from github import Github
from pygit2 import Signature

GIT_BASE_BRANCH = "origin/tb/hackathon"

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class GitOps(object):
    def __init__(
        self,
        github_token: str,
        repo_name: str,
        commiter_name: str,
        commiter_email: str,
        branch_name: str = "contract-deployer",
    ) -> None:
        self.github = Github(auth=Auth.Token(github_token))
        self.github_token = github_token
        self.repo_name = repo_name
        self.branch_name = branch_name
        self.signature = Signature(commiter_name, commiter_email)
        self.auth_callback = pygit2.RemoteCallbacks(
            pygit2.UserPass("x-access-token", self.github_token)
        )

        self.github_repo = None
        self.repo = None
        self.checkout_path = None

    def setup(self) -> None:
        self.checkout_path = Path(
            tempfile.mkdtemp(prefix="python-crosschain-contract-deployer-")
        )
        self.github_repo = self.github.get_repo(self.repo_name)

        # TODO if the branch doesn't exist, create it
        logger.info(
            f"Cloning {self.repo_name} into {self.checkout_path} (branch: {self.branch_name})..."
        )
        self.repo = pygit2.clone_repository(
            self.github_repo.clone_url,
            self.checkout_path,
            checkout_branch=self.branch_name,
            callbacks=self.auth_callback,
        )

        logger.info(f"Merging main branch into {self.branch_name}...")
        base_branch = self.repo.lookup_branch(GIT_BASE_BRANCH, pygit2.GIT_BRANCH_REMOTE)
        oid = base_branch.target
        print(f"Looked up OID {oid}")
        self.repo.merge(oid)

    def cleanup(self):
        return
        if self.checkout_path and os.path.exists(self.checkout_path):
            shutil.rmtree(self.checkout_path)
            logger.info("Deleted temp dir {}".format(self.checkout_path))
            self.checkout_path = None

        self.github_repo = None
        self.repo = None

    def commit_and_push(self, commit_message: str) -> None:
        self.repo.index.add_all()
        self.repo.index.write()

        tree = self.repo.index.write_tree()
        # TODO we should sign this commit
        self.repo.create_commit(
            "HEAD",
            self.signature,
            self.signature,
            commit_message,
            tree,
            [self.repo.head.target],
        )
        self.repo.remotes[0].push(
            [f"refs/heads/{self.branch_name}:refs/heads/{self.branch_name}"],
            callbacks=self.auth_callback,
        )

    def get_diff(self):
        self.repo.index.add_all()
        self.repo.index.write()
        return self.repo.diff(cached=True)

    def get_checkout_path(self):
        return self.checkout_path

    def create_pull_request(self, pr_title: str, pr_body: str | None = None):
        return self.github_repo.create_pull(
            title=pr_title, body=pr_body, head=self.branch_name, base=GIT_BASE_BRANCH
        )

    def __enter__(self):
        self.setup()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.cleanup()

    def __del__(self):
        self.cleanup()
