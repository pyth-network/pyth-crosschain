//! TUI cluster monitor and key utilities.

use anyhow::{Context, Result};
use bulk_keychain::Keypair;
use clap::{Parser, Subcommand};
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    symbols,
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Sparkline, Table, Tabs},
    Frame, Terminal,
};
use std::collections::{HashMap, VecDeque};
use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

const HISTORY_SIZE: usize = 60; // 60 samples for sparklines

#[derive(Parser)]
#[command(name = "cluster-monitor")]
#[command(about = "TUI monitor and key utilities for bulk-trade-pusher")]
struct Args {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run the TUI cluster monitor
    Monitor(MonitorArgs),
    /// Generate a new Ed25519 keypair
    Keygen(KeygenArgs),
    /// Show the public key from a private key
    Pubkey(PubkeyArgs),
    /// Grind for a keypair with a specific public key prefix
    KeyGrind(KeyGrindArgs),
}

#[derive(Parser)]
struct MonitorArgs {
    /// Pusher metrics endpoints (comma-separated host:port)
    #[arg(long, value_delimiter = ',')]
    pushers: Option<Vec<String>>,

    /// Validator metrics endpoints (comma-separated host:port)
    #[arg(long, value_delimiter = ',')]
    validators: Option<Vec<String>>,

    /// Auto-discover endpoints from Kubernetes pod IPs (requires in-cluster access)
    #[arg(long, default_value = "false")]
    k8s: bool,

    /// Use Tilt port-forwards (reads NUM_PUSHERS/NUM_VALIDATORS from .env)
    #[arg(long, default_value = "false")]
    tilt: bool,

    /// Refresh interval in milliseconds
    #[arg(long, default_value = "1000")]
    refresh_ms: u64,
}

#[derive(Parser)]
struct KeygenArgs {
    /// Output file path (if not specified, prints to stdout)
    #[arg(short, long)]
    output: Option<String>,
}

#[derive(Parser)]
struct PubkeyArgs {
    /// Path to .key file containing the private key
    #[arg(conflicts_with = "base58")]
    file: Option<String>,

    /// Base58-encoded private key string
    #[arg(long, conflicts_with = "file")]
    base58: Option<String>,
}

#[derive(Parser)]
struct KeyGrindArgs {
    /// Prefix to search for (case-sensitive by default)
    prefix: String,

    /// Case-insensitive matching
    #[arg(short, long, default_value = "false")]
    ignore_case: bool,

    /// Output file path (if not specified, prints to stdout)
    #[arg(short, long)]
    output: Option<String>,

    /// Number of threads to use (defaults to number of CPUs)
    #[arg(short, long)]
    threads: Option<usize>,
}

/// Metrics scraped from a pusher instance
#[derive(Debug, Clone, Default)]
struct PusherMetrics {
    instance: String,
    bulk_pushes_total: f64,
    push_accepted: f64,
    push_deduplicated: f64,
    push_error: f64,
    lazer_updates: f64,
    bulk_connections: f64,
    batch_size: f64,
    up: bool,
    last_error: Option<String>,
    // Calculated rates
    push_rate: f64,
    accept_rate: f64,
    // History for sparklines
    push_history: VecDeque<u64>,
    // Ping/pong metrics
    ping_latency_sum: f64,
    ping_latency_count: f64,
    ping_timeouts: f64,
}

/// Metrics scraped from a validator instance
#[derive(Debug, Clone, Default)]
struct ValidatorMetrics {
    instance: String,
    messages_received: f64,
    messages_accepted: f64,
    messages_deduplicated: f64,
    messages_error: f64,
    active_connections: f64,
    unique_signers: f64,
    prices: HashMap<String, f64>,
    signers: HashMap<String, f64>,
    up: bool,
    last_error: Option<String>,
    // Calculated rates
    msg_rate: f64,
    // History
    msg_history: VecDeque<u64>,
}

/// Previous values for rate calculation
#[derive(Debug, Clone, Default)]
struct PrevMetrics {
    pusher_pushes: HashMap<String, f64>,
    pusher_accepted: HashMap<String, f64>,
    validator_msgs: HashMap<String, f64>,
}

/// Application state
struct App {
    pushers: Vec<PusherMetrics>,
    validators: Vec<ValidatorMetrics>,
    pusher_endpoints: Vec<String>,
    validator_endpoints: Vec<String>,
    prev_metrics: PrevMetrics,
    selected_tab: usize,
    selected_row: usize,
    should_quit: bool,
    last_refresh: Instant,
    refresh_interval: Duration,
    total_push_history: VecDeque<u64>,
    total_msg_history: VecDeque<u64>,
    events: VecDeque<String>,
}

impl App {
    fn new(
        pusher_endpoints: Vec<String>,
        validator_endpoints: Vec<String>,
        refresh_ms: u64,
    ) -> Self {
        let pushers = pusher_endpoints
            .iter()
            .map(|e| PusherMetrics {
                instance: e.clone(),
                push_history: VecDeque::with_capacity(HISTORY_SIZE),
                ..Default::default()
            })
            .collect();

        let validators = validator_endpoints
            .iter()
            .map(|e| ValidatorMetrics {
                instance: e.clone(),
                msg_history: VecDeque::with_capacity(HISTORY_SIZE),
                ..Default::default()
            })
            .collect();

        Self {
            pushers,
            validators,
            pusher_endpoints,
            validator_endpoints,
            prev_metrics: PrevMetrics::default(),
            selected_tab: 0,
            selected_row: 0,
            should_quit: false,
            last_refresh: Instant::now(),
            refresh_interval: Duration::from_millis(refresh_ms),
            total_push_history: VecDeque::with_capacity(HISTORY_SIZE),
            total_msg_history: VecDeque::with_capacity(HISTORY_SIZE),
            events: VecDeque::with_capacity(100),
        }
    }

    fn next_tab(&mut self) {
        self.selected_tab = (self.selected_tab + 1) % 4;
        self.selected_row = 0;
    }

    fn prev_tab(&mut self) {
        self.selected_tab = if self.selected_tab == 0 {
            3
        } else {
            self.selected_tab - 1
        };
        self.selected_row = 0;
    }

    fn next_row(&mut self) {
        let max = match self.selected_tab {
            1 => self.pushers.len().saturating_sub(1),
            2 => self.validators.len().saturating_sub(1),
            _ => 0,
        };
        self.selected_row = (self.selected_row + 1).min(max);
    }

    fn prev_row(&mut self) {
        self.selected_row = self.selected_row.saturating_sub(1);
    }

    fn add_event(&mut self, msg: String) {
        let timestamp = chrono_lite();
        self.events.push_front(format!("[{timestamp}] {msg}"));
        if self.events.len() > 100 {
            self.events.pop_back();
        }
    }
}

fn chrono_lite() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() % 86400; // seconds since midnight UTC
    #[allow(clippy::integer_division, reason = "intentional time calculation")]
    let h = secs / 3600;
    #[allow(clippy::integer_division, reason = "intentional time calculation")]
    let m = (secs % 3600) / 60;
    let s = secs % 60;
    format!("{h:02}:{m:02}:{s:02}")
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    match args.command {
        Some(Command::Monitor(monitor_args)) => run_monitor(monitor_args).await,
        Some(Command::Keygen(keygen_args)) => run_keygen(keygen_args),
        Some(Command::Pubkey(pubkey_args)) => run_pubkey(pubkey_args),
        Some(Command::KeyGrind(grind_args)) => run_key_grind(grind_args),
        None => {
            // Default to monitor with default args
            run_monitor(MonitorArgs {
                pushers: None,
                validators: None,
                k8s: false,
                tilt: false,
                refresh_ms: 1000,
            })
            .await
        }
    }
}

/// Generate a new Ed25519 keypair
fn run_keygen(args: KeygenArgs) -> Result<()> {
    let keypair = Keypair::generate();
    let private_key_base58 = keypair.to_base58();
    let public_key_base58 = keypair.pubkey().to_string();

    if let Some(output_path) = args.output {
        std::fs::write(&output_path, &private_key_base58)
            .with_context(|| format!("failed to write key to {output_path}"))?;
        println!("Keypair generated and saved to: {output_path}");
        println!("Public key: {public_key_base58}");
    } else {
        println!("{private_key_base58}");
        eprintln!("Public key: {public_key_base58}");
    }

    Ok(())
}

/// Show the public key from a private key
fn run_pubkey(args: PubkeyArgs) -> Result<()> {
    let private_key_base58 = if let Some(file_path) = args.file {
        std::fs::read_to_string(&file_path)
            .with_context(|| format!("failed to read key from {file_path}"))?
            .trim()
            .to_string()
    } else if let Some(base58) = args.base58 {
        base58
    } else {
        anyhow::bail!("either a file path or --base58 must be provided");
    };

    let keypair = Keypair::from_base58(&private_key_base58)
        .map_err(|e| anyhow::anyhow!("failed to parse keypair: {}", e))?;

    println!("{}", keypair.pubkey());

    Ok(())
}

/// Grind for a keypair with a specific public key prefix
#[allow(
    clippy::expect_used,
    reason = "CLI tool - panics are acceptable for mutex/result access"
)]
fn run_key_grind(args: KeyGrindArgs) -> Result<()> {
    let prefix = if args.ignore_case {
        args.prefix.to_lowercase()
    } else {
        args.prefix.clone()
    };

    let num_threads = args.threads.unwrap_or_else(|| {
        std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(4)
    });

    eprintln!(
        "Grinding for prefix '{}' (case {}) using {} threads...",
        args.prefix,
        if args.ignore_case {
            "insensitive"
        } else {
            "sensitive"
        },
        num_threads
    );

    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let result: Arc<std::sync::Mutex<Option<Keypair>>> = Arc::new(std::sync::Mutex::new(None));

    let start = Instant::now();

    std::thread::scope(|s| {
        for _ in 0..num_threads {
            let found = found.clone();
            let attempts = attempts.clone();
            let result = result.clone();
            let prefix = prefix.clone();
            let ignore_case = args.ignore_case;

            s.spawn(move || {
                while !found.load(Ordering::Relaxed) {
                    let keypair = Keypair::generate();
                    let pubkey = keypair.pubkey().to_string();

                    let matches = if ignore_case {
                        pubkey.to_lowercase().starts_with(&prefix)
                    } else {
                        pubkey.starts_with(&prefix)
                    };

                    if matches {
                        if !found.swap(true, Ordering::SeqCst) {
                            let mut r = result.lock().expect("mutex poisoned");
                            *r = Some(keypair);
                        }
                        return;
                    }

                    let count = attempts.fetch_add(1, Ordering::Relaxed);
                    if count.is_multiple_of(100_000) && count > 0 {
                        let elapsed = start.elapsed().as_secs_f64();
                        let rate = count as f64 / elapsed;
                        eprint!("\r{count} attempts ({rate:.0} keys/sec)...");
                    }
                }
            });
        }
    });

    let elapsed = start.elapsed();
    let total_attempts = attempts.load(Ordering::Relaxed);
    eprintln!(
        "\nFound after {} attempts in {:.2}s ({:.0} keys/sec)",
        total_attempts,
        elapsed.as_secs_f64(),
        total_attempts as f64 / elapsed.as_secs_f64()
    );

    let keypair = result
        .lock()
        .map_err(|_| anyhow::anyhow!("mutex poisoned"))?
        .take()
        .ok_or_else(|| anyhow::anyhow!("no keypair found"))?;
    let private_key_base58 = keypair.to_base58();
    let public_key_base58 = keypair.pubkey().to_string();

    if let Some(output_path) = args.output {
        std::fs::write(&output_path, &private_key_base58)
            .with_context(|| format!("failed to write key to {output_path}"))?;
        println!("Keypair saved to: {output_path}");
        println!("Public key: {public_key_base58}");
    } else {
        println!("{private_key_base58}");
        eprintln!("Public key: {public_key_base58}");
    }

    Ok(())
}

/// Run the TUI cluster monitor
async fn run_monitor(args: MonitorArgs) -> Result<()> {
    let (pusher_endpoints, validator_endpoints) = if args.k8s {
        discover_k8s_endpoints().await?
    } else if args.tilt {
        discover_tilt_endpoints()?
    } else if args.pushers.is_some() || args.validators.is_some() {
        let pushers = args.pushers.unwrap_or_default();
        let validators = args.validators.unwrap_or_default();
        (pushers, validators)
    } else {
        // Default: try .env first, fall back to single instance
        discover_tilt_endpoints().unwrap_or_else(|_| {
            (
                vec!["localhost:9091".to_string()],
                vec!["localhost:9100".to_string()],
            )
        })
    };

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new(pusher_endpoints, validator_endpoints, args.refresh_ms);
    app.add_event("Monitor started".to_string());

    // Initial refresh
    refresh_metrics(&mut app).await;

    // Run the app
    let result = run_app(&mut terminal, &mut app).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(e) = result {
        eprintln!("Error: {e:?}");
    }

    Ok(())
}

async fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    app: &mut App,
) -> Result<()> {
    let mut last_tick = Instant::now();

    loop {
        terminal.draw(|f| ui(f, app))?;

        let timeout = app.refresh_interval.saturating_sub(last_tick.elapsed());
        if event::poll(timeout.min(Duration::from_millis(100)))? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match key.code {
                        KeyCode::Char('q') | KeyCode::Esc => app.should_quit = true,
                        KeyCode::Tab => app.next_tab(),
                        KeyCode::BackTab => app.prev_tab(),
                        KeyCode::Right => app.next_tab(),
                        KeyCode::Left => app.prev_tab(),
                        KeyCode::Down | KeyCode::Char('j') => app.next_row(),
                        KeyCode::Up | KeyCode::Char('k') => app.prev_row(),
                        KeyCode::Char('r') => {
                            refresh_metrics(app).await;
                            app.add_event("Manual refresh".to_string());
                        }
                        _ => {}
                    }
                }
            }
        }

        if app.should_quit {
            return Ok(());
        }

        if last_tick.elapsed() >= app.refresh_interval {
            refresh_metrics(app).await;
            last_tick = Instant::now();
        }
    }
}

// Truncate a non-negative f64 to u64 for sparkline display
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "intentional truncation for sparkline display, value is non-negative"
)]
fn f64_to_sparkline_u64(value: f64) -> u64 {
    value.max(0.0) as u64
}

#[allow(
    clippy::indexing_slicing,
    reason = "indices are bounds-checked at loop start with continue guard"
)]
async fn refresh_metrics(app: &mut App) {
    let refresh_interval_secs = app.refresh_interval.as_secs_f64();

    // Refresh pushers in parallel
    let pusher_futures: Vec<_> = app
        .pusher_endpoints
        .iter()
        .map(|e| scrape_pusher_metrics(e))
        .collect();

    let pusher_results = futures::future::join_all(pusher_futures).await;

    let mut total_push_rate = 0.0;
    for (i, result) in pusher_results.into_iter().enumerate() {
        if i >= app.pushers.len() {
            continue;
        }

        match result {
            Ok(mut metrics) => {
                // Calculate rates
                let prev_pushes = app
                    .prev_metrics
                    .pusher_pushes
                    .get(&metrics.instance)
                    .copied()
                    .unwrap_or(metrics.bulk_pushes_total);
                let prev_accepted = app
                    .prev_metrics
                    .pusher_accepted
                    .get(&metrics.instance)
                    .copied()
                    .unwrap_or(metrics.push_accepted);

                let push_delta = metrics.bulk_pushes_total - prev_pushes;
                let accept_delta = metrics.push_accepted - prev_accepted;

                metrics.push_rate = push_delta / refresh_interval_secs;
                metrics.accept_rate = accept_delta / refresh_interval_secs;
                total_push_rate += metrics.push_rate;

                // Update history
                metrics.push_history = app.pushers[i].push_history.clone();
                metrics
                    .push_history
                    .push_back(f64_to_sparkline_u64(push_delta));
                if metrics.push_history.len() > HISTORY_SIZE {
                    metrics.push_history.pop_front();
                }

                // Store for next calculation
                app.prev_metrics
                    .pusher_pushes
                    .insert(metrics.instance.clone(), metrics.bulk_pushes_total);
                app.prev_metrics
                    .pusher_accepted
                    .insert(metrics.instance.clone(), metrics.push_accepted);

                // Check for state changes
                if !app.pushers[i].up && metrics.up {
                    app.add_event(format!("Pusher {} came UP", metrics.instance));
                } else if app.pushers[i].up && !metrics.up {
                    app.add_event(format!("Pusher {} went DOWN", metrics.instance));
                }

                app.pushers[i] = metrics;
            }
            Err(e) => {
                if app.pushers[i].up {
                    app.add_event(format!("Pusher {} error: {}", app.pushers[i].instance, e));
                }
                app.pushers[i].up = false;
                app.pushers[i].last_error = Some(e.to_string());
                app.pushers[i].push_rate = 0.0;
            }
        }
    }

    // Update total push history
    app.total_push_history
        .push_back(f64_to_sparkline_u64(total_push_rate));
    if app.total_push_history.len() > HISTORY_SIZE {
        app.total_push_history.pop_front();
    }

    // Refresh validators in parallel
    let validator_futures: Vec<_> = app
        .validator_endpoints
        .iter()
        .map(|e| scrape_validator_metrics(e))
        .collect();

    let validator_results = futures::future::join_all(validator_futures).await;

    let mut total_msg_rate = 0.0;
    for (i, result) in validator_results.into_iter().enumerate() {
        if i >= app.validators.len() {
            continue;
        }

        match result {
            Ok(mut metrics) => {
                // Calculate rates
                let prev_msgs = app
                    .prev_metrics
                    .validator_msgs
                    .get(&metrics.instance)
                    .copied()
                    .unwrap_or(metrics.messages_received);

                let msg_delta = metrics.messages_received - prev_msgs;
                metrics.msg_rate = msg_delta / refresh_interval_secs;
                total_msg_rate += metrics.msg_rate;

                // Update history
                metrics.msg_history = app.validators[i].msg_history.clone();
                metrics
                    .msg_history
                    .push_back(f64_to_sparkline_u64(msg_delta));
                if metrics.msg_history.len() > HISTORY_SIZE {
                    metrics.msg_history.pop_front();
                }

                // Store for next calculation
                app.prev_metrics
                    .validator_msgs
                    .insert(metrics.instance.clone(), metrics.messages_received);

                // Check for state changes
                if !app.validators[i].up && metrics.up {
                    app.add_event(format!("Validator {} came UP", metrics.instance));
                } else if app.validators[i].up && !metrics.up {
                    app.add_event(format!("Validator {} went DOWN", metrics.instance));
                }

                app.validators[i] = metrics;
            }
            Err(e) => {
                if app.validators[i].up {
                    app.add_event(format!(
                        "Validator {} error: {}",
                        app.validators[i].instance, e
                    ));
                }
                app.validators[i].up = false;
                app.validators[i].last_error = Some(e.to_string());
                app.validators[i].msg_rate = 0.0;
            }
        }
    }

    // Update total msg history
    app.total_msg_history
        .push_back(f64_to_sparkline_u64(total_msg_rate));
    if app.total_msg_history.len() > HISTORY_SIZE {
        app.total_msg_history.pop_front();
    }

    app.last_refresh = Instant::now();
}

async fn scrape_pusher_metrics(endpoint: &str) -> Result<PusherMetrics> {
    let url = format!("http://{endpoint}/metrics");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()?;

    let body = client
        .get(&url)
        .send()
        .await
        .context("failed to fetch metrics")?
        .text()
        .await
        .context("failed to read response")?;

    let mut metrics = PusherMetrics {
        instance: endpoint.to_string(),
        up: true,
        push_history: VecDeque::with_capacity(HISTORY_SIZE),
        ..Default::default()
    };

    for line in body.lines() {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        if let Some((name, value)) = parse_metric_line(line) {
            match name.as_str() {
                "bulk_pushes_total" => metrics.bulk_pushes_total += value,
                "bulk_push_results_total" if line.contains("accepted") => {
                    metrics.push_accepted += value
                }
                "bulk_push_results_total" if line.contains("deduplicated") => {
                    metrics.push_deduplicated += value
                }
                "bulk_push_results_total" if line.contains("error") => metrics.push_error += value,
                "lazer_updates_received_total" => metrics.lazer_updates += value,
                "bulk_connections_active" => metrics.bulk_connections = value,
                "batch_size" => metrics.batch_size = value,
                // Ping/pong metrics from websocket-delivery
                "ws_ping_latency_seconds_sum" => metrics.ping_latency_sum = value,
                "ws_ping_latency_seconds_count" => metrics.ping_latency_count = value,
                "ws_ping_timeouts_total" => metrics.ping_timeouts += value,
                _ => {}
            }
        }
    }

    Ok(metrics)
}

async fn scrape_validator_metrics(endpoint: &str) -> Result<ValidatorMetrics> {
    let url = format!("http://{endpoint}/metrics");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()?;

    let body = client
        .get(&url)
        .send()
        .await
        .context("failed to fetch metrics")?
        .text()
        .await
        .context("failed to read response")?;

    let mut metrics = ValidatorMetrics {
        instance: endpoint.to_string(),
        up: true,
        msg_history: VecDeque::with_capacity(HISTORY_SIZE),
        ..Default::default()
    };

    for line in body.lines() {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        if let Some((name, value)) = parse_metric_line(line) {
            match name.as_str() {
                "validator_requests_received_total" => metrics.messages_received += value,
                "validator_messages_by_status_total" if line.contains("accepted") => {
                    metrics.messages_accepted = value
                }
                "validator_messages_by_status_total" if line.contains("dedup") => {
                    // Matches dedup_nonce, dedup_time, dedup_random
                    metrics.messages_deduplicated += value
                }
                "validator_messages_by_status_total" if line.contains("error") => {
                    metrics.messages_error += value
                }
                "validator_active_connections" => metrics.active_connections = value,
                "validator_unique_signers" => metrics.unique_signers = value,
                "validator_messages_by_signer_total" => {
                    if let Some(signer) = extract_label(line, "signer") {
                        metrics.signers.insert(signer, value);
                    }
                }
                "validator_last_price" => {
                    if let Some(feed_id) = extract_label(line, "feed_id") {
                        metrics.prices.insert(feed_id, value);
                    }
                }
                _ => {}
            }
        }
    }

    Ok(metrics)
}

fn parse_metric_line(line: &str) -> Option<(String, f64)> {
    let parts: Vec<&str> = line.rsplitn(2, ' ').collect();
    if parts.len() != 2 {
        return None;
    }

    let value: f64 = parts.first()?.parse().ok()?;
    let name_part = *parts.get(1)?;

    let name = if let Some(idx) = name_part.find('{') {
        name_part.get(..idx)?
    } else {
        name_part
    };

    Some((name.to_string(), value))
}

fn extract_label(line: &str, label: &str) -> Option<String> {
    let pattern = format!("{label}=\"");
    let start = line.find(&pattern)?;
    let rest = line.get(start + pattern.len()..)?;
    let end = rest.find('"')?;
    Some(rest.get(..end)?.to_string())
}

/// Discover endpoints from .env file (for Tilt port-forwards)
fn discover_tilt_endpoints() -> Result<(Vec<String>, Vec<String>)> {
    let env_path = std::env::current_dir()?.join(".env");
    let content = std::fs::read_to_string(&env_path)
        .context("failed to read .env file - are you in the project root?")?;

    let mut num_pushers: u16 = 3;
    let mut num_validators: u16 = 2;

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            match key.trim() {
                "NUM_PUSHERS" => {
                    if let Ok(n) = value.trim().parse() {
                        num_pushers = n;
                    }
                }
                "NUM_VALIDATORS" => {
                    if let Ok(n) = value.trim().parse() {
                        num_validators = n;
                    }
                }
                _ => {}
            }
        }
    }

    // Tilt port-forward convention:
    // Pushers: 9091, 9092, 9093... (9090 + pusher number)
    // Validators: 9100, 9101, 9102... (9099 + validator number)
    let pushers: Vec<String> = (1..=num_pushers)
        .map(|i| format!("localhost:{}", 9090 + i))
        .collect();
    let validators: Vec<String> = (1..=num_validators)
        .map(|i| format!("localhost:{}", 9099 + i))
        .collect();

    Ok((pushers, validators))
}

async fn discover_k8s_endpoints() -> Result<(Vec<String>, Vec<String>)> {
    let output = tokio::process::Command::new("kubectl")
        .args([
            "get",
            "pods",
            "-n",
            "lazer-pusher-dev",
            "-o",
            "jsonpath={range .items[*]}{.metadata.name} {.status.podIP}{\"\\n\"}{end}",
        ])
        .output()
        .await
        .context("failed to run kubectl")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut pushers = Vec::new();
    let mut validators = Vec::new();

    for line in stdout.lines() {
        let mut parts = line.split_whitespace();
        let Some(name) = parts.next() else { continue };
        let Some(ip) = parts.next() else { continue };

        if name.starts_with("pusher-") {
            pushers.push(format!("{ip}:9090"));
        } else if name.starts_with("mock-validator-") {
            validators.push(format!("{ip}:9090"));
        }
    }

    if pushers.is_empty() && validators.is_empty() {
        anyhow::bail!("No pods found in bulk-trade-dev namespace. Is the cluster running?");
    }

    Ok((pushers, validators))
}

#[allow(
    clippy::indexing_slicing,
    reason = "Layout::split always returns exactly as many Rects as there are Constraints"
)]
fn ui(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Tabs
            Constraint::Min(0),    // Content
            Constraint::Length(1), // Status bar
        ])
        .split(f.area());

    // Tabs
    let titles = vec![
        "Overview [1]",
        "Pushers [2]",
        "Validators [3]",
        "Events [4]",
    ];
    let tabs = Tabs::new(titles)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Bulk Trade Cluster Monitor "),
        )
        .select(app.selected_tab)
        .style(Style::default().fg(Color::White))
        .highlight_style(
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )
        .divider(symbols::line::VERTICAL);
    f.render_widget(tabs, chunks[0]);

    // Content based on selected tab
    match app.selected_tab {
        0 => render_overview(f, app, chunks[1]),
        1 => render_pushers(f, app, chunks[1]),
        2 => render_validators(f, app, chunks[1]),
        3 => render_events(f, app, chunks[1]),
        _ => {}
    }

    // Status bar
    let pushers_up = app.pushers.iter().filter(|p| p.up).count();
    let validators_up = app.validators.iter().filter(|v| v.up).count();
    let total_rate: f64 = app.pushers.iter().map(|p| p.push_rate).sum();

    let status = Line::from(vec![
        Span::raw(" "),
        Span::styled("q", Style::default().fg(Color::Yellow)),
        Span::raw(" quit  "),
        Span::styled("←→", Style::default().fg(Color::Yellow)),
        Span::raw(" tabs  "),
        Span::styled("↑↓", Style::default().fg(Color::Yellow)),
        Span::raw(" select  "),
        Span::styled("r", Style::default().fg(Color::Yellow)),
        Span::raw(" refresh  │  "),
        Span::styled(
            format!("P:{}/{}", pushers_up, app.pushers.len()),
            if pushers_up == app.pushers.len() {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::Red)
            },
        ),
        Span::raw("  "),
        Span::styled(
            format!("V:{}/{}", validators_up, app.validators.len()),
            if validators_up == app.validators.len() {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::Red)
            },
        ),
        Span::raw("  │  "),
        Span::styled(
            format!("{total_rate:.1}/s"),
            Style::default().fg(Color::Cyan),
        ),
        Span::raw("  │  "),
        Span::raw(format!(
            "{:.1}s ago",
            app.last_refresh.elapsed().as_secs_f64()
        )),
    ]);
    let status_bar = Paragraph::new(status).style(Style::default().bg(Color::DarkGray));
    f.render_widget(status_bar, chunks[2]);
}

#[allow(
    clippy::indexing_slicing,
    reason = "Layout::split always returns exactly as many Rects as there are Constraints"
)]
fn render_overview(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(8),  // Stats + sparklines
            Constraint::Length(10), // Prices
            Constraint::Min(0),     // Health
        ])
        .split(area);

    // Top section: stats and sparklines
    let top_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[0]);

    // Stats
    let total_pushes: f64 = app.pushers.iter().map(|p| p.bulk_pushes_total).sum();
    let total_accepted: f64 = app.pushers.iter().map(|p| p.push_accepted).sum();
    let total_dedup: f64 = app.pushers.iter().map(|p| p.push_deduplicated).sum();
    let total_errors: f64 = app.pushers.iter().map(|p| p.push_error).sum();
    let total_push_rate: f64 = app.pushers.iter().map(|p| p.push_rate).sum();
    let total_msg_rate: f64 = app.validators.iter().map(|v| v.msg_rate).sum();

    let success_rate = if total_pushes > 0.0 {
        (total_accepted / total_pushes) * 100.0
    } else {
        0.0
    };

    let stats_text = vec![
        Line::from(vec![
            Span::raw("Push Rate: "),
            Span::styled(
                format!("{total_push_rate:.1}/s"),
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("    Msg Rate: "),
            Span::styled(
                format!("{total_msg_rate:.1}/s"),
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::raw("Total: "),
            Span::styled(
                format!("{total_pushes:.0}"),
                Style::default().fg(Color::White),
            ),
            Span::raw("  "),
            Span::styled(
                format!("✓{total_accepted:.0}"),
                Style::default().fg(Color::Green),
            ),
            Span::raw("  "),
            Span::styled(
                format!("⟳{total_dedup:.0}"),
                Style::default().fg(Color::Yellow),
            ),
            Span::raw("  "),
            Span::styled(
                format!("✗{total_errors:.0}"),
                Style::default().fg(Color::Red),
            ),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::raw("Success Rate: "),
            Span::styled(
                format!("{success_rate:.1}%"),
                if success_rate >= 99.0 {
                    Style::default().fg(Color::Green)
                } else if success_rate >= 95.0 {
                    Style::default().fg(Color::Yellow)
                } else {
                    Style::default().fg(Color::Red)
                },
            ),
        ]),
    ];

    let stats = Paragraph::new(stats_text)
        .block(Block::default().borders(Borders::ALL).title(" Statistics "));
    f.render_widget(stats, top_chunks[0]);

    // Sparklines
    let spark_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(top_chunks[1]);

    let push_data: Vec<u64> = app.total_push_history.iter().copied().collect();
    let push_sparkline = Sparkline::default()
        .block(Block::default().borders(Borders::ALL).title(" Push Rate "))
        .data(&push_data)
        .style(Style::default().fg(Color::Cyan));
    f.render_widget(push_sparkline, spark_chunks[0]);

    let msg_data: Vec<u64> = app.total_msg_history.iter().copied().collect();
    let msg_sparkline = Sparkline::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Validator Msg Rate "),
        )
        .data(&msg_data)
        .style(Style::default().fg(Color::Magenta));
    f.render_widget(msg_sparkline, spark_chunks[1]);

    // Prices table (from validators only - pushers don't track prices)
    let mut all_prices: HashMap<String, f64> = HashMap::new();
    for v in &app.validators {
        for (feed_id, price) in &v.prices {
            all_prices.insert(feed_id.clone(), *price);
        }
    }

    let mut price_list: Vec<_> = all_prices.iter().collect();
    price_list.sort_by(|a, b| a.0.cmp(b.0));

    let price_rows: Vec<Row> = price_list
        .iter()
        .map(|(feed_id, price)| {
            Row::new(vec![
                Cell::from((*feed_id).clone()).style(Style::default().fg(Color::White)),
                Cell::from(format!("${price:.2}")).style(Style::default().fg(Color::Green)),
            ])
        })
        .collect();

    let price_table = Table::new(price_rows, [Constraint::Length(10), Constraint::Length(15)])
        .header(
            Row::new(vec!["Feed ID", "Price"]).style(
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            ),
        )
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Current Prices "),
        );
    f.render_widget(price_table, chunks[1]);

    // Health indicators
    render_health(f, app, chunks[2]);
}

#[allow(
    clippy::indexing_slicing,
    reason = "Layout::split always returns exactly as many Rects as there are Constraints"
)]
fn render_health(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // Pusher health
    let pusher_rows: Vec<Row> = app
        .pushers
        .iter()
        .map(|p| {
            let (status, style) = if p.up {
                ("● UP", Style::default().fg(Color::Green))
            } else {
                ("○ DOWN", Style::default().fg(Color::Red))
            };

            let rate_style = if p.push_rate > 5.0 {
                Style::default().fg(Color::Green)
            } else if p.push_rate > 0.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            // Calculate average ping latency in ms
            let ping_avg_ms = if p.ping_latency_count > 0.0 {
                (p.ping_latency_sum / p.ping_latency_count) * 1000.0
            } else {
                0.0
            };

            let ping_style = if ping_avg_ms == 0.0 {
                Style::default().fg(Color::DarkGray)
            } else if ping_avg_ms < 50.0 {
                Style::default().fg(Color::Green)
            } else if ping_avg_ms < 200.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::Red)
            };

            Row::new(vec![
                Cell::from(short_name(&p.instance)),
                Cell::from(status).style(style),
                Cell::from(format!("{:.1}/s", p.push_rate)).style(rate_style),
                Cell::from(if ping_avg_ms > 0.0 {
                    format!("{ping_avg_ms:.0}ms")
                } else {
                    "-".to_string()
                })
                .style(ping_style),
            ])
        })
        .collect();

    let pusher_table = Table::new(
        pusher_rows,
        [
            Constraint::Min(12),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(8),
        ],
    )
    .header(
        Row::new(vec!["Instance", "Status", "Rate", "Ping"])
            .style(Style::default().fg(Color::Yellow)),
    )
    .block(Block::default().borders(Borders::ALL).title(" Pushers "));
    f.render_widget(pusher_table, chunks[0]);

    // Validator health
    let validator_rows: Vec<Row> = app
        .validators
        .iter()
        .map(|v| {
            let (status, style) = if v.up {
                ("● UP", Style::default().fg(Color::Green))
            } else {
                ("○ DOWN", Style::default().fg(Color::Red))
            };

            let rate_style = if v.msg_rate > 5.0 {
                Style::default().fg(Color::Green)
            } else if v.msg_rate > 0.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            Row::new(vec![
                Cell::from(short_name(&v.instance)),
                Cell::from(status).style(style),
                Cell::from(format!("{:.1}/s", v.msg_rate)).style(rate_style),
                Cell::from(format!("{:.0}", v.active_connections)),
                Cell::from(format!("{:.0}", v.unique_signers)),
            ])
        })
        .collect();

    let validator_table = Table::new(
        validator_rows,
        [
            Constraint::Min(12),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(6),
            Constraint::Length(6),
        ],
    )
    .header(
        Row::new(vec!["Instance", "Status", "Rate", "Conn", "Sign"])
            .style(Style::default().fg(Color::Yellow)),
    )
    .block(Block::default().borders(Borders::ALL).title(" Validators "));
    f.render_widget(validator_table, chunks[1]);
}

#[allow(
    clippy::indexing_slicing,
    reason = "Layout::split always returns exactly as many Rects as there are Constraints"
)]
fn render_pushers(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(10), Constraint::Length(6)])
        .split(area);

    let rows: Vec<Row> = app
        .pushers
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let success_rate = if p.bulk_pushes_total > 0.0 {
                p.push_accepted / p.bulk_pushes_total * 100.0
            } else {
                0.0
            };

            let (status, status_style) = if p.up {
                ("●", Style::default().fg(Color::Green))
            } else {
                ("○", Style::default().fg(Color::Red))
            };

            let rate_style = if p.push_rate > 5.0 {
                Style::default().fg(Color::Green)
            } else if p.push_rate > 0.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let row_style = if i == app.selected_row {
                Style::default().bg(Color::DarkGray)
            } else {
                Style::default()
            };

            // Calculate average ping latency in ms
            let ping_avg_ms = if p.ping_latency_count > 0.0 {
                (p.ping_latency_sum / p.ping_latency_count) * 1000.0
            } else {
                0.0
            };

            let ping_style = if ping_avg_ms == 0.0 {
                Style::default().fg(Color::DarkGray)
            } else if ping_avg_ms < 50.0 {
                Style::default().fg(Color::Green)
            } else if ping_avg_ms < 200.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::Red)
            };

            Row::new(vec![
                Cell::from(status).style(status_style),
                Cell::from(short_name(&p.instance)),
                Cell::from(format!("{:.1}/s", p.push_rate)).style(rate_style),
                Cell::from(format!("{:.0}", p.bulk_pushes_total)),
                Cell::from(format!("{:.0}", p.push_accepted))
                    .style(Style::default().fg(Color::Green)),
                Cell::from(format!("{:.0}", p.push_deduplicated))
                    .style(Style::default().fg(Color::Yellow)),
                Cell::from(format!("{:.0}", p.push_error)).style(Style::default().fg(Color::Red)),
                Cell::from(format!("{success_rate:.1}%")),
                Cell::from(if ping_avg_ms > 0.0 {
                    format!("{ping_avg_ms:.0}ms")
                } else {
                    "-".to_string()
                })
                .style(ping_style),
                Cell::from(format!("{:.0}", p.batch_size)),
            ])
            .style(row_style)
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(2),
            Constraint::Min(12),
            Constraint::Length(8),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(6),
        ],
    )
    .header(
        Row::new(vec![
            "", "Instance", "Rate", "Pushes", "Accept", "Dedup", "Error", "Succ%", "Ping", "Batch",
        ])
        .style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Pusher Details "),
    );

    f.render_widget(table, chunks[0]);

    // Sparkline for selected pusher
    if let Some(p) = app.pushers.get(app.selected_row) {
        let data: Vec<u64> = p.push_history.iter().copied().collect();
        let sparkline = Sparkline::default()
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(format!(" {} Push Rate History ", short_name(&p.instance))),
            )
            .data(&data)
            .style(Style::default().fg(Color::Cyan));
        #[allow(
            clippy::indexing_slicing,
            reason = "Layout::split always returns required chunks"
        )]
        f.render_widget(sparkline, chunks[1]);
    }
}

#[allow(
    clippy::indexing_slicing,
    reason = "Layout::split always returns exactly as many Rects as there are Constraints"
)]
fn render_validators(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(10), Constraint::Length(8)])
        .split(area);

    let rows: Vec<Row> = app
        .validators
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let accept_rate = if v.messages_received > 0.0 {
                v.messages_accepted / v.messages_received * 100.0
            } else {
                0.0
            };

            let (status, status_style) = if v.up {
                ("●", Style::default().fg(Color::Green))
            } else {
                ("○", Style::default().fg(Color::Red))
            };

            let rate_style = if v.msg_rate > 5.0 {
                Style::default().fg(Color::Green)
            } else if v.msg_rate > 0.0 {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let row_style = if i == app.selected_row {
                Style::default().bg(Color::DarkGray)
            } else {
                Style::default()
            };

            Row::new(vec![
                Cell::from(status).style(status_style),
                Cell::from(short_name(&v.instance)),
                Cell::from(format!("{:.1}/s", v.msg_rate)).style(rate_style),
                Cell::from(format!("{:.0}", v.messages_received)),
                Cell::from(format!("{:.0}", v.messages_accepted))
                    .style(Style::default().fg(Color::Green)),
                Cell::from(format!("{:.0}", v.messages_deduplicated))
                    .style(Style::default().fg(Color::Yellow)),
                Cell::from(format!("{:.0}", v.messages_error))
                    .style(Style::default().fg(Color::Red)),
                Cell::from(format!("{accept_rate:.1}%")),
                Cell::from(format!("{:.0}", v.active_connections)),
                Cell::from(format!("{:.0}", v.unique_signers)),
            ])
            .style(row_style)
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(2),
            Constraint::Min(12),
            Constraint::Length(8),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(6),
            Constraint::Length(6),
        ],
    )
    .header(
        Row::new(vec![
            "", "Instance", "Rate", "Received", "Accept", "Dedup", "Error", "Acc%", "Conn", "Sign",
        ])
        .style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Validator Details "),
    );

    f.render_widget(table, chunks[0]);

    // Signer distribution for selected validator
    if let Some(v) = app.validators.get(app.selected_row) {
        let mut signers: Vec<_> = v.signers.iter().collect();
        signers.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

        let signer_rows: Vec<Row> = signers
            .iter()
            .take(5)
            .map(|(signer, count)| {
                Row::new(vec![
                    Cell::from((*signer).clone()),
                    Cell::from(format!("{count:.0}")),
                ])
            })
            .collect();

        let signer_table = Table::new(signer_rows, [Constraint::Min(15), Constraint::Length(10)])
            .header(Row::new(vec!["Signer", "Messages"]).style(Style::default().fg(Color::Yellow)))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(format!(" {} Signers ", short_name(&v.instance))),
            );
        #[allow(
            clippy::indexing_slicing,
            reason = "Layout::split always returns required chunks"
        )]
        f.render_widget(signer_table, chunks[1]);
    }
}

fn render_events(f: &mut Frame, app: &App, area: Rect) {
    let events: Vec<Line> = app
        .events
        .iter()
        .map(|e| {
            let style = if e.contains("UP") {
                Style::default().fg(Color::Green)
            } else if e.contains("DOWN") || e.contains("error") {
                Style::default().fg(Color::Red)
            } else {
                Style::default().fg(Color::White)
            };
            Line::styled(e.clone(), style)
        })
        .collect();

    let paragraph = Paragraph::new(events)
        .block(Block::default().borders(Borders::ALL).title(" Events "))
        .wrap(ratatui::widgets::Wrap { trim: false });

    f.render_widget(paragraph, area);
}

fn short_name(instance: &str) -> String {
    // Extract just the port or a short identifier
    if let Some(port) = instance.rsplit(':').next() {
        if instance.starts_with("localhost") || instance.starts_with("127.") {
            return format!(":{port}");
        }
    }
    // For k8s IPs, show last octet + port
    let mut parts = instance.split(':');
    let Some(ip) = parts.next() else {
        return instance.to_string();
    };
    let Some(port) = parts.next() else {
        return instance.to_string();
    };

    let ip_parts: Vec<&str> = ip.split('.').collect();
    if ip_parts.len() == 4 {
        if let Some(last_octet) = ip_parts.get(3) {
            return format!("...{last_octet}:{port}");
        }
    }
    instance.to_string()
}
