@IsTest
private class CalculatorTests {
  @IsTest
  static void testDivideByZero() {
    Test.startTest();
    try {
      Calculator.divide(10, 0);
      Assert.fail('Expected divide to throw when denominator is zero.');
    } catch (Calculator.CalculatorException ex) {
      Assert.areEqual(
        'You still can\'t divide by zero',
        ex.getMessage(),
        'Expected divide-by-zero exception message.'
      );
    }
    Test.stopTest();
  }
}
