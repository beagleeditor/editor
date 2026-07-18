use std::{
    io::{BufReader, BufWriter},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
};

pub struct LspServer {
    pub child: Child,
    pub stdin: BufWriter<ChildStdin>,
    pub stdout: BufReader<ChildStdout>,
}

impl LspServer {
    pub fn spawn(command: &str, args: &[&str]) -> anyhow::Result<Self> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;

        Ok(Self {
            stdin: BufWriter::new(child.stdin.take().unwrap()),
            stdout: BufReader::new(child.stdout.take().unwrap()),
            child,
        })
    }

    pub fn kill(&mut self) {
        let _ = self.child.kill();
    }
}