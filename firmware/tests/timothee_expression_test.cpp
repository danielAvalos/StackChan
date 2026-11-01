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

    return 0;
}
