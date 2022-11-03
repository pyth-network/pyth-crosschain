use std::{env, fs, path::PathBuf, path::Path};

use ethers::contract::Abigen;
use ethers::solc::{remappings::Remapping, Artifact, Project, ProjectPathsConfig, Solc};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pyth_evm_src_root =
        env::var("PYTH_XC_TOOL_EVM_SRC_ROOT").unwrap_or("../ethereum/".to_string());
    let evm_path = PathBuf::from(&pyth_evm_src_root).canonicalize()?;

    let solc = Solc::default();
    eprintln!("Got Solc!");

    // Remappings are a primitive that solc uses to facilitate imports
    // similar to `import "@openzeppelin/contracts/VeryAwesomeStandardContract.sol"`.
    // In this example, a remapping would tell solc that
    // `@openzeppelin` means <pkg root>/node_modules/@openzeppelin.
    let mut remappings = Remapping::find_many(&evm_path);

    // NOTE(2022-11-03): For some reason, the @pythnetwork package
    // namespace upsets the remapping search, replace the wrong
    // generated path with the correct value here.
    remappings.iter_mut().for_each(|r| {
        if r.name == "@pythnetwork/".to_string() {
            r.path = evm_path
                .join("node_modules/@pythnetwork")
                .to_str()
                .unwrap()
                .to_string();
        }
    });

    eprintln!("Found {} remappings:", remappings.len());
    for (idx, r) in remappings.iter().enumerate() {
        eprintln!("{} - {}", idx + 1, r);
    }
    let solc_project = Project::builder()
        .solc(solc)
        .paths(
            ProjectPathsConfig::builder()
                .root(&evm_path)
                .artifacts(evm_path.join("out"))
                .cache(evm_path.join("cache"))
                .sources(evm_path.join("contracts"))
                .remappings(remappings)
                .build()?,
        )
        .build()?;

    eprintln!("Got solc project!");

    let solc_build_output = solc_project.compile()?;

    if solc_build_output.has_compiler_errors() {
        let errors = solc_build_output.output().errors;
        let e_count = errors.len();
        for (idx, e) in errors.iter().enumerate() {
            eprintln!(
                "======== Error {} of {} =========\n{}\n",
                idx + 1,
                e_count,
                e
            );
        }
        return Err("Solc build failed.".into());
    }

    eprintln!("Solc project compiled OK!");

    let mut abi_idx = 1;
    for (name, abi) in solc_build_output
        .artifacts()
        // Call into_abi() for each artifact, discard None's via
        // `filter_map`, further process Some's via `map`
        .filter_map(|(name, a)| a.clone().into_abi().map(|abi| (name, abi)))
    {
        eprintln!("ABI {}: {}", abi_idx, name);

        let bindings = Abigen::new(&name, serde_json::to_string(&abi)?)?.generate()?;

        eprintln!("Bindings generated OK!");

        let bindings_out_path = Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/src/bindings_evm"));

        if !bindings_out_path.exists() {
            fs::create_dir_all(bindings_out_path)?;
            eprintln!("Out dir created OK!");
        }
        eprintln!("Out dir checked OK!");

        bindings.write_module_in_dir(bindings_out_path)?;

        eprintln!("Bindings written OK!");

        abi_idx += 1;
    }

    if abi_idx == 1 {
        return Err(format!(
            "No ABIs were processed. Does {} know the correct EVM contract root?",
            file!()
        )
        .into());
    }

    Ok(())
}
