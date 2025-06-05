{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    mkCli.url = "github:cprussin/mkCli";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    flake-utils,
    mkCli,
    rust-overlay,
    ...
  }: (
    flake-utils.lib.eachDefaultSystem
    (
      system: let
        cli-overlay = nixpkgs.lib.composeExtensions mkCli.overlays.default (_: prev: let
          cargo = "cargo --color=always";
        in {
          cli = prev.lib.mkCli "cli" {
            _noAll = true;
            start = "${cargo} sqlx migrate run && ${cargo} sqlx prepare && RUST_LOG=info ${cargo} watch -x 'run -- run'";
            test = {
              format = "${cargo} fmt --check";
              lint = "${cargo} sqlx migrate run && ${cargo} sqlx prepare && ${cargo} clippy --color always";
              unit = "${cargo} sqlx migrate run && ${cargo} sqlx prepare && ${cargo} test -- --color always";
            };
            fix = {
              format = "${cargo} fmt";
              lint = "${cargo} sqlx migrate run && ${cargo} sqlx prepare && ${cargo} clippy -- --color always --fix";
            };
          };
        });

        pkgs = import nixpkgs {
          inherit system;
          overlays = [cli-overlay rust-overlay.overlays.default];
          config = {};
        };
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.cli
            pkgs.git
            pkgs.openssl
            pkgs.pkg-config
            pkgs.rust-analyzer
            pkgs.rust-bin.stable."1.82.0".default
            pkgs.sqlx-cli
            pkgs.foundry
            pkgs.sqlite
            pkgs.cargo-watch
          ];
        };
      }
    )
  );
}
