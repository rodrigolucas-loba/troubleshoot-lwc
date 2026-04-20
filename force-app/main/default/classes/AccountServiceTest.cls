@isTest
private class AccountServiceTest {
  @isTest
  static void should_create_account() {
    String acctName = 'Salesforce';
    String acctNumber = '12345';
    String tickerSymbol = 'CRM';

    Test.startTest();
    Account res = AccountService.createAccount(
      acctName,
      acctNumber,
      tickerSymbol
    );
    Test.stopTest();

    System.assertEquals(tickerSymbol, res.TickerSymbol);
  }
}
