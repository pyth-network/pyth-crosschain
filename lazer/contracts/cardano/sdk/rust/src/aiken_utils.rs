use std::{io, path::Path, rc::Rc};

use aiken_lang::gen_uplc::builder::convert_constants_to_data;
use aiken_project::{Project, options::Options, telemetry::EventTarget};
use anyhow::{Result, anyhow};
use uplc::{
    Fragment as _, PlutusData,
    ast::{Constant, Data, DeBruijn, NamedDeBruijn, Program, Term},
    machine::cost_model::ExBudget,
};

pub fn with_project(
    dir: Option<&Path>,
    with: impl FnOnce(&mut Project<EventTarget>) -> Result<()>,
) -> Result<()> {
    let mut with = Some(with);
    aiken_project::watch::with_project(dir, true, false, false, |project| {
        project.compile(Options::default())?;
        let with = with.take().ok_or_else(|| {
            vec![io::Error::other(anyhow!("expected single project in directory")).into()]
        })?;
        with(project).map_err(|e| vec![io::Error::other(e).into()])
    })
    .map_err(|r| anyhow!(r))
}

pub fn apply_hex_params_to_program<T: Clone>(
    mut program: Program<T>,
    args: &[String],
) -> Result<Program<T>> {
    for arg in args {
        let data = PlutusData::decode_fragment(&hex::decode(arg)?).map_err(|e| anyhow!("{e}"))?;
        program = program.apply_data(data);
    }
    Ok(program)
}

pub fn constant_to_data(constant: Rc<Constant>) -> PlutusData {
    let constant = convert_constants_to_data(vec![constant])
        .pop()
        .expect("convert_constants_to_data returned empty vector");
    let Constant::Data(data) = constant else {
        panic!("convert_constants_to_data did not return Data")
    };
    data
}

pub fn term_to_data(term: Term<NamedDeBruijn>) -> PlutusData {
    match term {
        Term::Constant(constant) => constant_to_data(constant),
        Term::Constr { tag, fields } => {
            Data::constr(tag as u64, fields.into_iter().map(term_to_data).collect())
        }
        _ => panic!("unsupported term"),
    }
}

pub fn eval_to_data(program: Program<DeBruijn>) -> Result<PlutusData> {
    Ok(term_to_data(
        program
            .eval(ExBudget::max())
            .result()
            .map_err(|e| anyhow!("{e:?}"))?,
    ))
}
