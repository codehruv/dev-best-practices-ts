{
  description = "Pinned toolchain for dev-best-practices-ts";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            git
            just
            lefthook
            gitleaks
            ripgrep
            jq
            actionlint
            zizmor
          ];

          # pnpm comes from Corepack so its version always matches `packageManager` in
          # package.json, which nixpkgs cannot guarantee.
          # Anchored at the repo root, so entering the shell from a subdirectory reuses
          # the same install.
          shellHook = ''
            repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            export COREPACK_HOME="$repo_root/.direnv/corepack"
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
            mkdir -p "$repo_root/.direnv/bin"
            corepack enable --install-directory "$repo_root/.direnv/bin" pnpm
            export PATH="$repo_root/.direnv/bin:$PATH"
          '';
        };
      }
    );
}
