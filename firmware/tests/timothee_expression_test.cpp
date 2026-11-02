#include "stackchan/timothee/timothee_expression.h"

#include <cassert>
#include <string_view>

int main()
{
    using timothee::SemanticState;

    SemanticState state = SemanticState::Neutral;
    assert(timothee::parseSemanticState("thinking", state));
    assert(state == SemanticState::Thinking);
    assert(timothee::semanticStateName(state) == std::string_view("thinking"));

    assert(!timothee::parseSemanticState("execute_genesis", state));
    assert(state == SemanticState::Thinking);

    const auto expression = timothee::expressionFor(SemanticState::Acknowledgement);
    assert(expression.emotion == stackchan::avatar::Emotion::Happy);
    assert(expression.red == 30);
    assert(expression.green == 210);
    assert(expression.blue == 100);
    assert(expression.brightness_percent == 40);
    assert(expression.duration_ms == 500);

    const timothee::BridgePolicy default_policy;
    assert(timothee::validateBridgeRequest(default_policy, "thinking", 500, true)
           == timothee::BridgeStatus::Disabled);

    const timothee::BridgePolicy enabled_policy{ true, 6000 };
    assert(timothee::validateBridgeRequest(enabled_policy, "execute_genesis", 500, true)
           == timothee::BridgeStatus::InvalidState);
    assert(timothee::validateBridgeRequest(enabled_policy, "thinking", 500, false)
           == timothee::BridgeStatus::AvatarUnavailable);

    const timothee::BridgePolicy invalid_policy{ true, 0 };
    assert(timothee::validateBridgeRequest(invalid_policy, "thinking", 500, true)
           == timothee::BridgeStatus::DurationOutOfRange);

    return 0;
}
