Set-StrictMode -Version Latest

function ConvertTo-DexMap {
    param($Value)
    $map = @{}
    if ($null -ne $Value) {
        if ($Value -is [System.Collections.IDictionary]) { foreach ($key in $Value.Keys) { $map[$key] = $Value[$key] } }
        else { foreach ($property in $Value.PSObject.Properties) { $map[$property.Name] = $property.Value } }
    }
    return $map
}

function Get-DexFingerprint {
    param([string]$Value)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return -join ($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())) | ForEach-Object { $_.ToString('x2') }) }
    finally { $algorithm.Dispose() }
}

function Assert-DexUuid {
    param([string]$Value)
    $parsed = [guid]::Empty
    if (-not [guid]::TryParse($Value, [ref]$parsed) -or $parsed -eq [guid]::Empty) { throw 'Expected a non-empty UUID.' }
}

function Assert-DexManifest {
    param($Manifest, [switch]$AllowIncomplete)
    $value = ConvertTo-DexMap $Manifest
    $fields = @('schemaVersion','repository','branch','resourceGroup','location','staticSiteName','cosmosAccountName','cosmosDatabaseName','cosmosContainerName','cosmosDatabaseThroughput','legacyStorageAccountName','tableName','sku','defaultHostName','url','tenantFingerprint','credential')
    if ($value.Count -ne $fields.Count -or @($value.Keys | Where-Object { $_ -notin $fields }).Count -ne 0) { throw 'Unexpected manifest fields; refusing to serialize credentials or raw provider output.' }
    if ($value.schemaVersion -ne 2 -or $value.repository -cne 'Hyeongdae/edu' -or $value.branch -cne 'main' -or $value.sku -cne 'Standard' -or
        $value.cosmosAccountName -cne 'maze-rescue-ms-b7af62a9' -or $value.cosmosDatabaseName -cne 'stair-climb' -or $value.cosmosContainerName -cne 'players' -or
        $value.cosmosDatabaseThroughput -ne 400 -or $value.legacyStorageAccountName -cne 'stdexescape384874bc' -or $value.tableName -cne 'DexEscapePlayers') { throw 'Unexpected deployment target.' }
    if ($value.resourceGroup -notmatch '^[a-z0-9][a-z0-9-]{1,88}$' -or $value.location -notmatch '^[a-z][a-z0-9]+$' -or
        $value.staticSiteName -notmatch '^[a-z0-9][a-z0-9-]{1,59}$' -or $value.legacyStorageAccountName -notmatch '^[a-z0-9]{3,24}$' -or
        $value.tenantFingerprint -notmatch '^[a-f0-9]{12}$') { throw 'Invalid deployment names or tenant fingerprint.' }
    if ($value.defaultHostName) {
        if ($value.defaultHostName -notmatch '^[a-z0-9][a-z0-9.-]*\.azurestaticapps\.net$' -or $value.url -cne ('https://' + $value.defaultHostName)) { throw 'Unexpected production hostname.' }
    } elseif (-not $AllowIncomplete -or $value.url) { throw 'Missing production hostname.' }
    $credential = ConvertTo-DexMap $value.credential
    if ($credential.Count -ne 2 -or -not $credential.ContainsKey('keyId') -or -not $credential.ContainsKey('expiresAt')) { throw 'Unexpected credential metadata.' }
    if ($credential.keyId) {
        Assert-DexUuid $credential.keyId
        try { $null = [DateTimeOffset]::Parse($credential.expiresAt) } catch { throw 'Invalid credential expiry.' }
    } elseif (-not $AllowIncomplete -or $credential.expiresAt) { throw 'Missing credential metadata.' }
}

function Get-DeploymentPlan {
    param([string]$SubscriptionId = '', [string]$TenantId = '', [string]$ClientId = '',
        [string]$ResourceGroup = 'grill-me-edu', [string]$Location = 'eastasia',
        [string]$StaticSiteName = '', [string]$Repository = 'Hyeongdae/edu', $SavedManifest = $null)
    foreach ($value in @($SubscriptionId, $TenantId, $ClientId)) { if ($value) { Assert-DexUuid $value } }
    if ($Repository -cne 'Hyeongdae/edu') { throw 'This deployment tool is scoped to Hyeongdae/edu.' }
    $ready = [bool]($SubscriptionId -and $TenantId -and $ClientId)
    $suffix = 'preview'
    if ($ready) { $suffix = (Get-DexFingerprint ($Repository + $SubscriptionId + $TenantId)).Substring(0, 8) }
    if (-not $StaticSiteName) { $StaticSiteName = 'swa-dex-escape-prod-' + $suffix }
    # Keep the historical field name but bind recovery to the full intended Azure identity context.
    $fingerprint = if ($ready) { (Get-DexFingerprint ($TenantId + '|' + $SubscriptionId + '|' + $ClientId)).Substring(0, 12) } else { '000000000000' }
    if ($null -ne $SavedManifest) {
        Assert-DexManifest $SavedManifest -AllowIncomplete
        if ($ready -and $SavedManifest.tenantFingerprint -cne $fingerprint) { throw 'Saved deployment belongs to another subscription, tenant or app.' }
        $fingerprint = $SavedManifest.tenantFingerprint
        $ResourceGroup = $SavedManifest.resourceGroup; $Location = $SavedManifest.location
        $StaticSiteName = $SavedManifest.staticSiteName
    }
    $manifest = [ordered]@{ schemaVersion = 2; repository = $Repository; branch = 'main'; resourceGroup = $ResourceGroup;
        location = $Location; staticSiteName = $StaticSiteName; cosmosAccountName = 'maze-rescue-ms-b7af62a9'; cosmosDatabaseName = 'stair-climb';
        cosmosContainerName = 'players'; cosmosDatabaseThroughput = 400; legacyStorageAccountName = 'stdexescape384874bc'; tableName = 'DexEscapePlayers';
        sku = 'Standard'; defaultHostName = ''; url = ''; tenantFingerprint = $fingerprint;
        credential = @{ keyId = ''; expiresAt = '' } }
    Assert-DexManifest $manifest -AllowIncomplete
    return [pscustomobject]@{ SubscriptionId = $SubscriptionId; TenantId = $TenantId; ClientId = $ClientId;
        IdentityConfigured = $ready; Target = $manifest;
        Tags = @{ project = 'dex-escape'; repository = $Repository; environment = 'production' } }
}

function Merge-EntraWebRedirects {
    param([string[]]$Existing = @(), [string]$Callback)
    $uri = $null
    if (-not [uri]::TryCreate($Callback, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -cne 'https' -or
        $uri.Host -notmatch '^[a-z0-9][a-z0-9.-]*\.azurestaticapps\.net$' -or $uri.AbsolutePath -cne '/.auth/login/aad/callback' -or
        $uri.Query -or $uri.Fragment -or $uri.UserInfo -or -not $uri.IsDefaultPort) { throw 'Invalid company game web callback.' }
    $next = [Collections.Generic.List[string]]::new()
    foreach ($value in @($Existing) + @($Callback)) { if (-not $next.Contains($value)) { $next.Add($value) } }
    return $next.ToArray()
}

function Assert-DexOwnedResource {
    param($Resource, [string]$ExpectedName, $Tags)
    $actual = ConvertTo-DexMap $Resource.tags
    if ($Resource.name -cne $ExpectedName) { throw 'Resource name does not match the saved deployment.' }
    foreach ($key in $Tags.Keys) { if (-not $actual.ContainsKey($key) -or $actual[$key] -cne $Tags[$key]) { throw 'Refusing to adopt an unowned resource.' } }
}

function Assert-DexDeploymentPermissions {
    param($Permissions, [switch]$NeedResourceGroupCreation)
    $required = @('Microsoft.Resources/subscriptions/resourceGroups/read',
        'Microsoft.Web/staticSites/read', 'Microsoft.Web/staticSites/write',
        'Microsoft.Web/staticSites/config/write', 'Microsoft.Web/staticSites/listappsettings/action',
        'Microsoft.Web/staticSites/listsecrets/action', 'Microsoft.DocumentDB/databaseAccounts/read',
        'Microsoft.DocumentDB/databaseAccounts/listKeys/action', 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/read',
        'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/read', 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/write')
    if ($NeedResourceGroupCreation) { $required += 'Microsoft.Resources/subscriptions/resourceGroups/write' }
    foreach ($action in $required) {
        $granted = @($Permissions.value | Where-Object {
            $entry = $_
            @($entry.actions | Where-Object { $action -like $_ }).Count -gt 0 -and
                @($entry.notActions | Where-Object { $action -like $_ }).Count -eq 0
        }).Count -gt 0
        if (-not $granted) { throw 'Azure resource deployment permissions are missing at the intended scope. No resources were created; ask an administrator for the required deployment access.' }
    }
}

function Write-DexManifest {
    param($Manifest, [string]$Path, [switch]$AllowIncomplete)
    Assert-DexManifest $Manifest -AllowIncomplete:$AllowIncomplete
    $directory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    $null = [IO.Directory]::CreateDirectory($directory)
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($Path), ($Manifest | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

function Invoke-DexTool {
    param([string]$Tool, [string[]]$Arguments, [AllowNull()][string]$InputText)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if (-not [string]::IsNullOrEmpty($InputText)) { $output = @($InputText | & $Tool @Arguments 2>&1) }
        else { $output = @(& $Tool @Arguments 2>&1) }
        if ($LASTEXITCODE -ne 0) { throw 'Nonzero tool exit.' }
        if ($Arguments[0] -in @('secret','variable')) { return $null }
        $text = ($output | ForEach-Object { $_.ToString() }) -join "`n"
        if ([string]::IsNullOrWhiteSpace($text)) { return $null }
        return ConvertFrom-Json -InputObject $text -ErrorAction Stop
    } catch { throw ('External operation failed: ' + [IO.Path]::GetFileName($Tool) + '/' + $Arguments[0] + '. Raw output was suppressed.') }
    finally { $ErrorActionPreference = $previousPreference }
}

function New-DexPrivateDirectory {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('dex-game-private-' + [guid]::NewGuid().ToString('N'))
    $null = [IO.Directory]::CreateDirectory($directory)
    if ($env:OS -eq 'Windows_NT') {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true, $false)
        foreach ($identity in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
            $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
            $acl.AddAccessRule($rule)
        }
        Set-Acl -LiteralPath $directory -AclObject $acl
    } else {
        & chmod 700 $directory
        if ($LASTEXITCODE -ne 0) { throw 'Could not restrict private temporary directory.' }
    }
    return [IO.Path]::GetFullPath($directory)
}

Export-ModuleMember -Function Get-DeploymentPlan, Merge-EntraWebRedirects, Assert-DexManifest, Assert-DexOwnedResource, Assert-DexDeploymentPermissions, Write-DexManifest, ConvertTo-DexMap, Invoke-DexTool, New-DexPrivateDirectory
