use {bytemuck::from_bytes, std::mem::size_of};

pub mod buffer;
pub mod config;
pub mod errors;
pub mod publisher_config;

fn format(data: &[u8]) -> Option<u32> {
    if data.len() < size_of::<u32>() {
        return None;
    }
    let format: &u32 = from_bytes(&data[..size_of::<u32>()]);
    Some(*format)
}
