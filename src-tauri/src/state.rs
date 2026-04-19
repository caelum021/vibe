use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use notify::RecommendedWatcher;

use crate::error::AppError;
use crate::link_index::LinkGraph;

pub struct AppState {
    pub root: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub link_graph: Arc<LinkGraph>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            root: Mutex::new(None),
            watcher: Mutex::new(None),
            link_graph: Arc::new(LinkGraph::new()),
        }
    }

    pub fn get_root(&self) -> Result<PathBuf, AppError> {
        self.root
            .lock()
            .map_err(|_| AppError::LockPoisoned)?
            .clone()
            .ok_or(AppError::NoRootSet)
    }
}
