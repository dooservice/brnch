/// How a prompt ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcpOutcome {
    /// The reason the agent gave for stopping, such as `EndTurn` or `Cancelled`.
    pub stop_reason: String,
    /// Everything the agent said as its answer, in order.
    pub message: String,
}
