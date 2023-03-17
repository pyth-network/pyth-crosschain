{ pkgs ? import <nixpkgs> {}
, ...
}:

with pkgs; mkShell {
  buildInputs = [
    clang
    llvmPackages.libclang
    nettle
    openssl
    pkgconfig
    rustup
    systemd
  ];

  shellHook = ''
    export LIBCLANG_PATH="${llvmPackages.libclang.lib}/lib";
  '';
}
