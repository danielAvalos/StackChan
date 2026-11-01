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

}  // namespace timothee
