use {
    crate::payload::{EVM_FORMAT_MAGIC, SOLANA_FORMAT_MAGIC_LE},
    anyhow::bail,
    byteorder::{ReadBytesExt, WriteBytesExt, BE, LE},
    std::io::{Cursor, Read, Write},
};

/// EVM signature enveope.
#[derive(Debug, Clone)]
pub struct EvmMessage {
    pub payload: Vec<u8>,
    pub signature: [u8; 64],
    pub recovery_id: u8,
}

impl EvmMessage {
    pub fn serialize(&self, mut writer: impl Write) -> anyhow::Result<()> {
        writer.write_u32::<BE>(EVM_FORMAT_MAGIC)?;
        writer.write_all(&self.signature)?;
        writer.write_u8(self.recovery_id)?;
        writer.write_u16::<BE>(self.payload.len().try_into()?)?;
        writer.write_all(&self.payload)?;
        Ok(())
    }

    pub fn deserialize_slice(data: &[u8]) -> anyhow::Result<Self> {
        Self::deserialize(Cursor::new(data))
    }

    pub fn deserialize(mut reader: impl Read) -> anyhow::Result<Self> {
        let magic = reader.read_u32::<BE>()?;
        if magic != EVM_FORMAT_MAGIC {
            bail!("magic mismatch");
        }
        let mut signature = [0u8; 64];
        reader.read_exact(&mut signature)?;
        let recovery_id = reader.read_u8()?;
        let payload_len: usize = reader.read_u16::<BE>()?.into();
        let mut payload = vec![0u8; payload_len];
        reader.read_exact(&mut payload)?;
        Ok(Self {
            payload,
            signature,
            recovery_id,
        })
    }
}

/// Solana signature envelope.
#[derive(Debug, Clone)]
pub struct SolanaMessage {
    pub payload: Vec<u8>,
    pub signature: [u8; 64],
    pub public_key: [u8; 32],
}

impl SolanaMessage {
    pub fn serialize(&self, mut writer: impl Write) -> anyhow::Result<()> {
        writer.write_u32::<LE>(SOLANA_FORMAT_MAGIC_LE)?;
        writer.write_all(&self.signature)?;
        writer.write_all(&self.public_key)?;
        writer.write_u16::<LE>(self.payload.len().try_into()?)?;
        writer.write_all(&self.payload)?;
        Ok(())
    }

    pub fn deserialize_slice(data: &[u8]) -> anyhow::Result<Self> {
        Self::deserialize(Cursor::new(data))
    }

    pub fn deserialize(mut reader: impl Read) -> anyhow::Result<Self> {
        let magic = reader.read_u32::<LE>()?;
        if magic != SOLANA_FORMAT_MAGIC_LE {
            bail!("magic mismatch");
        }
        let mut signature = [0u8; 64];
        reader.read_exact(&mut signature)?;
        let mut public_key = [0u8; 32];
        reader.read_exact(&mut public_key)?;
        let payload_len: usize = reader.read_u16::<LE>()?.into();
        let mut payload = vec![0u8; payload_len];
        reader.read_exact(&mut payload)?;
        Ok(Self {
            payload,
            signature,
            public_key,
        })
    }
}
