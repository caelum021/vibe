use std::path::PathBuf;

use tauri::State;

use crate::error::AppError;
use crate::link_index::{Backlink, BrokenLink, GraphData, OutgoingLink};
use crate::state::AppState;

#[tauri::command]
pub fn get_outgoing_links(
    path: String,
    state: State<AppState>,
) -> Result<Vec<OutgoingLink>, AppError> {
    let p = PathBuf::from(&path);
    Ok(state.link_graph.outgoing_links(&p))
}

#[tauri::command]
pub fn get_backlinks(
    path: String,
    state: State<AppState>,
) -> Result<Vec<Backlink>, AppError> {
    let p = PathBuf::from(&path);
    Ok(state.link_graph.backlinks(&p))
}

#[tauri::command]
pub fn get_broken_links(state: State<AppState>) -> Result<Vec<BrokenLink>, AppError> {
    Ok(state.link_graph.broken_links())
}

#[tauri::command]
pub fn get_orphan_docs(state: State<AppState>) -> Result<Vec<String>, AppError> {
    Ok(state.link_graph.orphans())
}

#[tauri::command]
pub fn get_graph_data(state: State<AppState>) -> Result<GraphData, AppError> {
    Ok(state.link_graph.graph_data())
}
