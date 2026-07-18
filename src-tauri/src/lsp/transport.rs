use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};

use anyhow::{anyhow, Result};
use serde::Serialize;
use serde_json::Value;

pub struct Transport {
    child: Child,
    reader: Arc<Mutex<BufReader<ChildStdout>>>,
    writer: Arc<Mutex<BufWriter<ChildStdin>>>,
}

impl Transport {
    pub fn spawn(command: &str, args: &[&str]) -> Result<Self> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;

        Ok(Self {
            reader: Arc::new(Mutex::new(BufReader::new(
                child
                    .stdout
                    .take()
                    .ok_or_else(|| anyhow!("missing stdout"))?,
            ))),
            writer: Arc::new(Mutex::new(BufWriter::new(
                child.stdin.take().ok_or_else(|| anyhow!("missing stdin"))?,
            ))),
            child,
        })
    }

    pub fn send<T: Serialize>(&self, message: &T) -> Result<()> {
        let body = serde_json::to_vec(message)?;

        println!("send: waiting for writer lock");
        let mut writer = self.writer.lock().unwrap();
        println!("send: writer lock acquired");

        write!(writer, "Content-Length: {}\r\n\r\n", body.len())?;
        println!("send: header written");

        writer.write_all(&body)?;
        println!("send: body written");

        writer.flush()?;
        println!("send: flush complete");

        Ok(())
    }

    pub fn read_message(&self) -> Result<Value> {
        let mut content_length = None;
        let mut reader = self.reader.lock().unwrap();
        loop {
            let mut line = String::new();
            reader.read_line(&mut line)?;
            if line == "\r\n" || line == "\n" {
                break;
            }
            if let Some(v) = line.strip_prefix("Content-Length:") {
                content_length = Some(v.trim().parse::<usize>()?);
            }
        }
        let len = content_length.ok_or_else(|| anyhow!("missing Content-Length"))?;
        let mut body = vec![0; len];
        reader.read_exact(&mut body)?;
        Ok(serde_json::from_slice(&body)?)
    }

    pub fn kill(&mut self) -> Result<()> {
        self.child.kill()?;
        Ok(())
    }
}
