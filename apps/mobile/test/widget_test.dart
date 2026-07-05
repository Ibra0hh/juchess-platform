import 'package:flutter_test/flutter_test.dart';
import 'package:juchess_mobile/main.dart';

void main() {
  testWidgets('JuChess home screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(const JuChessApp());

    expect(find.text('JuChess'), findsOneWidget);
    expect(find.text('University of Jordan Chess Club'), findsOneWidget);
    expect(
      find.text('University of Jordan Rapid Championship'),
      findsOneWidget,
    );
    expect(find.text('Guest Mode'), findsOneWidget);
  });
}
