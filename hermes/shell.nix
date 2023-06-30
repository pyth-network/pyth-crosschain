{ pkgs ? import <nixpkgs> {}
, ...
}:

with pkgs; mkShell {
  buildInputs = [
    clang
    llvmPackages.libclang
    nettle
    openssl_1_1
    pkgconfig
    rustup
    systemd
  ];

  shellHook = ''
    export LIBCLANG_PATH="${llvmPackages.libclang.lib}/lib";
  '';
}
