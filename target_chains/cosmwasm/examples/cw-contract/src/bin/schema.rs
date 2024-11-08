use {
    cosmwasm_schema::write_api,
    example_cw_contract::msg::{ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg},
};

fn main() {
    write_api! {
        instantiate: InstantiateMsg,
        execute: ExecuteMsg,
        migrate: MigrateMsg,
        query: QueryMsg
    }
}
