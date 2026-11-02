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
    const BridgeStatus decision = validateBridgeRequest(_policy, semantic_state, duration_ms, stackchan.hasAvatar());
    if (decision != BridgeStatus::Applied) {
        return decision;
    }

    SemanticState state = SemanticState::Neutral;
    (void)parseSemanticState(semantic_state, state);

    const Expression expression = expressionFor(state);
    const uint32_t effective_duration = duration_ms == 0 ? expression.duration_ms : duration_ms;
    if (effective_duration == 0) {
        return BridgeStatus::DurationRequired;
    }
    if (effective_duration > _policy.max_duration_ms) {
        return BridgeStatus::DurationOutOfRange;
    }

    const auto scale = [brightness = expression.brightness_percent](uint8_t channel) {
        return static_cast<uint8_t>((static_cast<uint16_t>(channel) * brightness) / 100u);
    };
    stackchan.leftNeonLight().setColor(scale(expression.red), scale(expression.green), scale(expression.blue));
    stackchan.rightNeonLight().setColor(scale(expression.red), scale(expression.green), scale(expression.blue));
    stackchan.addModifier(std::make_unique<stackchan::TimedEmotionModifier>(expression.emotion, effective_duration));
    return BridgeStatus::Applied;
}

}  // namespace timothee
