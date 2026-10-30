# API integration tests

The API integration suite uses Microsoft's Linux Cosmos DB for NoSQL emulator. It creates a uniquely named database and `/accountId` container for the run, then deletes that database during cleanup. It does not use the company Cosmos account or production records.

Start the emulator in one terminal:

```powershell
docker run --rm --name stair-climb-cosmos-emulator -p 8081:8081 -p 8080:8080 mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest
```

In another terminal, run the integration suite:

```powershell
$env:COSMOS_EMULATOR_ENDPOINT = "http://127.0.0.1:8081/"
npm --prefix api run test:integration
Remove-Item Env:COSMOS_EMULATOR_ENDPOINT
```

The harness only accepts the local emulator gateway (`localhost`, `127.0.0.1`, or the CI service host `cosmos-emulator`) on port `8081`. It refuses to run when production record settings are present. Local game play does not start or connect to Cosmos and does not persist ranking or progress records.
