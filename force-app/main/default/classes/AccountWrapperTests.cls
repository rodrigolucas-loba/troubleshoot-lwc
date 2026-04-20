@IsTest
private class AccountWrapperTests {
  @TestSetup
  static void loadTestData() {
    Account avgAcct = new Account(Name = 'ACME Average');
    Account priorityAcct = new Account(Name = 'ACME Priority');
    insert new List<Account>{ avgAcct, priorityAcct };

    List<Opportunity> opps = new List<Opportunity>();
    for (Integer i = 0; i < 5; i++) {
      opps.add(
        new Opportunity(
          Name = 'Average Opp ' + i,
          AccountId = avgAcct.Id,
          Amount = 1500,
          CloseDate = Date.today().addDays(5),
          StageName = 'Prospecting'
        )
      );
      opps.add(
        new Opportunity(
          Name = 'Priority Opp ' + i,
          AccountId = priorityAcct.Id,
          Amount = 150000,
          CloseDate = Date.today().addDays(5),
          StageName = 'Prospecting'
        )
      );
    }
    insert opps;
  }

  @IsTest
  static void testPositiveRoundedAveragePrice() {
    Account acct = [
      SELECT Id
      FROM Account
      WHERE Name = 'ACME Average'
      LIMIT 1
    ];
    AccountWrapper acctWrapper = new AccountWrapper(acct);

    Test.startTest();
    Assert.areEqual(
      2000.00,
      acctWrapper.getRoundedAvgPriceOfOpps(),
      'Expected to get 2000.00'
    );
    Test.stopTest();
  }

  @IsTest
  static void testIsHighPriority() {
    Account acct = [
      SELECT Id
      FROM Account
      WHERE Name = 'ACME Priority'
      LIMIT 1
    ];
    AccountWrapper acctWrapper = new AccountWrapper(acct);

    Test.startTest();
    Assert.isTrue(
      acctWrapper.isHighPriority(),
      'Expected account to be high priority'
    );
    Test.stopTest();
  }
}
