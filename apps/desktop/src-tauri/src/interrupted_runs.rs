use brnch_agents::AgentEvent;
use brnch_core::BrnchResult;
use brnch_core::project::{EventHistoryStore, RunRecordStore};

const SUMMARY: &str = "La aplicación se cerró mientras el agente trabajaba.";

/// A run that never reported its end belongs to an earlier session of the app. It is closed as
/// failed so the window does not show it as working forever. Returns how many were closed.
pub fn close_interrupted_runs<Store>(store: &Store) -> BrnchResult<usize>
where
    Store: EventHistoryStore + RunRecordStore,
{
    let mut closed = 0;
    for workspace in store.workspaces_with_runs()? {
        let finished = store
            .last_event(&workspace)?
            .and_then(|stored| serde_json::from_str::<AgentEvent>(&stored.event_json).ok())
            .is_some_and(|event| matches!(event, AgentEvent::RunFinished { .. }));
        if !finished {
            let event = AgentEvent::RunFinished {
                succeeded: false,
                summary: SUMMARY.to_owned(),
                cost_in_dollars: None,
                duration_in_milliseconds: None,
                total_tokens: None,
            };
            if let Ok(json) = serde_json::to_string(&event) {
                store.append_event(&workspace, &json)?;
                closed += 1;
            }
        }
    }
    Ok(closed)
}
