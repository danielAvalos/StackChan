/*
 * SPDX-FileCopyrightText: 2026 OpenAI contributors
 *
 * SPDX-License-Identifier: MIT
 */
#include "timothee_expression_bridge.h"

#include "../modifiers/timed.h"

namespace timothee {

BridgeStatus ExpressionBridge::apply(stackchan::StackChan& stackchan, std::string_view semantic_state,
                                      uint32_t duration_ms) const
{
    if (!_policy.enabled) {
        return BridgeStatus::Disabled;
    }
    if (_policy.max_duration_ms == 0) {
        return BridgeStatus::DurationOutOfRange;
    }

    SemanticState state = SemanticState::Neutral;
    if (!parseSemanticState(semantic_state, state)) {
        return BridgeStatus::InvalidState;
    }
    if (!stackchan.hasAvatar()) {
        return BridgeStatus::AvatarUnavailable;
    }

    const Expression expression = expressionFor(state);
    const uint32_t effective_duration = duration_ms == 0 ? expression.duration_ms : duration_ms;
    if (effective_duration == 0) {
        return BridgeStatus::DurationRequired;
    }
    if (effective_duration > _policy.max_duration_ms) {
        return BridgeStatus::DurationOutOfRange;
    }

    stackchan.addModifier(std::make_unique<stackchan::TimedEmotionModifier>(expression.emotion, effective_duration));
    return BridgeStatus::Applied;
}

}  // namespace timothee
