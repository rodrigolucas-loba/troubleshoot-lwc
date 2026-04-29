# Salesforce Code Analyzer Summary

- Generated: 2026-04-29 16:28:08 +01:00
- Workspace: .
- Targets: force-app
- Rule selectors: Recommended, CustomPMD
- CSV report: .\docs\code-analyzer-report.csv
- Total findings: 52
- Highest reported severity: 4

## Severity Breakdown

| Severity | Findings |
| -------- | -------- |
| 4        | 40       |
| 3        | 8        |
| 2        | 3        |
| 1        | 1        |

## Findings by Engine

| Engine | Findings |
| ------ | -------- |
| pmd    | 48       |
| flow   | 3        |
| eslint | 1        |

## Top Files

| File                                                       | Findings |
| ---------------------------------------------------------- | -------- |
| force-app\main\default\classes\BadBunchController.cls      | 7        |
| force-app\main\default\classes\AccountWrapper.cls          | 6        |
| force-app\main\default\classes\Calculator.cls              | 6        |
| force-app\main\default\classes\AccountServiceTest.cls      | 5        |
| force-app\main\default\classes\HouseService.cls            | 4        |
| force-app\main\default\classes\AccountWrapperMock.cls      | 3        |
| force-app\main\default\classes\ExternalSearch.cls          | 3        |
| force-app\main\default\classes\HTTPMockFactory.cls         | 3        |
| force-app\main\default\classes\Test_BadBunchController.cls | 3        |
| force-app\main\default\classes\AccountService.cls          | 2        |

## Top Rules

| Rule                             | Findings |
| -------------------------------- | -------- |
| ApexDoc                          | 26       |
| ApexUnitTestClassShouldHaveRunAs | 8        |
| AnnotationsNamingConventions     | 5        |
| TriggerEntryCriteria             | 2        |
| ApexCRUDViolation                | 1        |
| AvoidGlobalModifier              | 1        |
| AvoidNonRestrictiveQueries       | 1        |
| CamelCaseMethodNaming            | 1        |
| ExcessiveParameterList           | 1        |
| FieldDeclarationsShouldBeAtStart | 1        |
