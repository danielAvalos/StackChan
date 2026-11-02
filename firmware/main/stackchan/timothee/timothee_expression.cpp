/*
 * SPDX-FileCopyrightText: 2026 OpenAI contributors
 *
 * SPDX-License-Identifier: MIT
 */
#include "timothee_expression.h"

namespace timothee {

bool parseSemanticState(std::string_view value, SemanticState& state)
{
    if (value == "neutral") {
        state = SemanticState::Neutral;
    } else if (value == "listening") {
        state = SemanticState::Listening;
    } else if (value == "thinking") {
        state = SemanticState::Thinking;
    } else if (value == "speaking") {
        state = SemanticState::Speaking;
    } else if (value == "acknowledgement") {
        state = SemanticState::Acknowledgement;
    } else if (value == "warning") {
        state = SemanticState::Warning;
    } else if (value == "sleeping") {
        state = SemanticState::Sleeping;
    } else {
        return false;
    }

    return true;
}

std::string_view semanticStateName(SemanticState state)
{
    switch (state) {
        case SemanticState::Neutral:
            return "neutral";
        case SemanticState::Listening:
            return "listening";
        case SemanticState::Thinking:
            return "thinking";
        case SemanticState::Speaking:
            return "speaking";
        case SemanticState::Acknowledgement:
            return "acknowledgement";
        case SemanticState::Warning:
            return "warning";
        case SemanticState::Sleeping:
            return "sleeping";
    }

    return "neutral";
}

Expression expressionFor(SemanticState state)
{
    switch (state) {
        case SemanticState::Listening:
            return { state, stackchan::avatar::Emotion::Neutral, 0, 180, 220, 45, 1200 };
        case SemanticState::Thinking:
            return { state, stackchan::avatar::Emotion::Doubt, 80, 90, 210, 32, 0 };
        case SemanticState::Speaking:
            return { state, stackchan::avatar::Emotion::Neutral, 0, 170, 190, 42, 0 };
        case SemanticState::Acknowledgement:
            return { state, stackchan::avatar::Emotion::Happy, 30, 210, 100, 40, 500 };
        case SemanticState::Warning:
            return { state, stackchan::avatar::Emotion::Doubt, 240, 120, 0, 42, 0 };
        case SemanticState::Sleeping:
            return { state, stackchan::avatar::Emotion::Sleepy, 35, 45, 90, 12, 800 };
        case SemanticState::Neutral:
        default:
            return { SemanticState::Neutral, stackchan::avatar::Emotion::Neutral, 0, 120, 170, 22, 0 };
    }
}

LedColor ledColorFor(const Expression& expression)
{
    const auto scale = [brightness = expression.brightness_percent](uint8_t channel) {
        return static_cast<uint8_t>((static_cast<uint16_t>(channel) * brightness) / 100u);
    };
    return { scale(expression.red), scale(expression.green), scale(expression.blue) };
}

BridgeStatus validateBridgeRequest(const BridgePolicy& policy, std::string_view semantic_state,
                                   uint32_t duration_ms, bool avatar_available)
{
    if (!policy.enabled) {
        return BridgeStatus::Disabled;
    }
    if (policy.max_duration_ms == 0) {
        return BridgeStatus::DurationOutOfRange;
    }

    SemanticState state = SemanticState::Neutral;
    if (!parseSemanticState(semantic_state, state)) {
        return BridgeStatus::InvalidState;
    }
    if (!avatar_available) {
        return BridgeStatus::AvatarUnavailable;
    }

    const uint32_t effective_duration = duration_ms == 0 ? expressionFor(state).duration_ms : duration_ms;
    if (effective_duration == 0) {
        return BridgeStatus::DurationRequired;
    }
    if (effective_duration > policy.max_duration_ms) {
        return BridgeStatus::DurationOutOfRange;
    }

    return BridgeStatus::Applied;
}

}  // namespace timothee
