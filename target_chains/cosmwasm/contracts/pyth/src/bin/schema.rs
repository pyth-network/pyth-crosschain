use {
    cosmwasm_schema::write_api,
    pyth_cosmwasm::msg::{InstantiateMsg, MigrateMsg},
    pyth_sdk_cw::{ExecuteMsg, QueryMsg},
};

fn main() {
    write_api! {
        instantiate: InstantiateMsg,
        execute: ExecuteMsg,
        migrate: MigrateMsg,
        query: QueryMsg
    }
}
