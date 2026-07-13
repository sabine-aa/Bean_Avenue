$ErrorActionPreference = "Stop"
$outDir = "c:\Users\sheha\OneDrive\Desktop\Bean Project\Bean_Avenue\inventory-templates"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outFile = Join-Path $outDir "Bean-Avenue-Inventory-Templates.xlsx"
if (Test-Path $outFile) { Remove-Item $outFile -Force }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Add()

function Add-Sheet($name, $headers, $rows, $textCols) {
  $ws = $wb.Worksheets.Add()
  $ws.Name = $name
  for ($c = 0; $c -lt $headers.Count; $c++) {
    $cell = $ws.Cells.Item(1, $c + 1)
    $cell.Value2 = $headers[$c]
    $cell.Font.Bold = $true
    $cell.Interior.Color = 4287811
    $cell.Font.Color = 16777215
  }
  if ($textCols) {
    foreach ($tc in $textCols) { $ws.Columns.Item($tc).NumberFormat = "@" }
  }
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $row = $rows[$r]
    for ($c = 0; $c -lt $row.Count; $c++) {
      $ws.Cells.Item($r + 2, $c + 1).Value2 = [string]$row[$c]
    }
  }
  $ws.Rows.Item(1).RowHeight = 22
  $ws.UsedRange.Columns.AutoFit() | Out-Null
  $ws.Application.ActiveWindow.SplitRow = 1
  $ws.Application.ActiveWindow.FreezePanes = $true
  return $ws
}

$insHeaders = @("Bean Avenue - Inventory Import Templates", "")
$insRows = @(
  @("HOW TO USE", "Fill the 4 tabs, then import them in Admin > Inventory > Import (one tab at a time or the whole workbook)."),
  @("UNITS - IMPORTANT", "Always use BASE units: g (grams), ml (millilitres), pc (pieces). Do NOT use kg or litres - the system does not auto-convert. Enter 5000 g, not 5 kg. Enter 20000 ml, not 20 L."),
  @("NAMES MUST MATCH", "In the Recipes tab, 'Inventory Item Used' must match an Item Name in the Current Stock tab exactly, and 'Menu Item Name' must match a product in the Menu Manager exactly. The importer warns about mismatches before saving."),
  @("SIZE column", "Blank = recipe applies to ALL sizes. Or put Small / Medium / Large to make that line size-specific."),
  @("ADD-ON column", "Blank = base recipe (always deducted). Put an add-on name = only deducted when that add-on is chosen."),
  @("DEDUCTION RULE", "ADD = consume on top of the base recipe (extra shot, syrup, boba). REPLACE = swap out the base ingredient (Oat Milk replaces regular Milk). For REPLACE, model the choice as a single-select add-on group (Milk: Regular / Oat / Almond)."),
  @("DATES", "Use format YYYY-MM-DD, e.g. 2026-12-31. Blank if not tracked."),
  @("HANSON", "Hanson doughnuts are tracked DAILY on the 'D - Hanson Daily' tab (not the Products tab). Enter how many you made each morning."),
  @("VALIDATION", "Nothing is saved until you review. The importer shows errors like: 'Vanilla Syrup used in a recipe but missing from Current Stock', or 'Unit mismatch: recipe uses ml but item is tracked in g'.")
)
Add-Sheet "Instructions" $insHeaders $insRows @() | Out-Null

$aH = @("Item Name","Inventory Category","Unit","Current Quantity","Minimum Quantity","Cost per Unit","Supplier","Expiry Date","Track Expiry","Notes")
$aR = @(
  @("Milk","Dairy","ml","20000","5000","0.0012","Supplier A","","No","Enter ml, not litres"),
  @("Oat Milk","Dairy-Free","ml","8000","2000","0.0025","Supplier A","","No",""),
  @("Coffee Beans","Coffee","g","10000","2000","0.02","Supplier B","","No",""),
  @("Matcha Powder","Powders","g","1000","200","0.08","Supplier E","","No",""),
  @("Protein Powder","Powders","g","2000","300","0.05","","","No",""),
  @("Vanilla Syrup","Syrups","ml","3000","500","0.004","Supplier D","","No",""),
  @("Boba Pearls","Toppings","g","2000","400","0.01","Supplier F","","No",""),
  @("Cup 16oz","Packaging","pc","500","100","0.05","Supplier C","","No",""),
  @("Lid 16oz","Packaging","pc","500","100","0.03","Supplier C","","No",""),
  @("Straw","Packaging","pc","1000","200","0.01","Supplier C","","No",""),
  @("Water Bottle 500ml","Beverages","pc","200","40","0.30","","2026-12-31","Yes","")
)
Add-Sheet "A - Current Stock" $aH $aR @(8) | Out-Null

$bH = @("Menu Item Name","Menu Category","Size","Add-on (if any)","Inventory Item Used","Quantity Used","Unit","Deduction Rule","Notes")
$bR = @(
  @("Iced Latte","Iced Coffee","Medium","","Coffee Beans","18","g","ADD","base recipe"),
  @("Iced Latte","Iced Coffee","Medium","","Milk","250","ml","ADD",""),
  @("Iced Latte","Iced Coffee","Medium","","Cup 16oz","1","pc","ADD",""),
  @("Iced Latte","Iced Coffee","Medium","","Lid 16oz","1","pc","ADD",""),
  @("Iced Latte","Iced Coffee","Medium","","Straw","1","pc","ADD",""),
  @("Latte","Hot Coffee","Small","","Milk","180","ml","ADD","size-specific milk"),
  @("Latte","Hot Coffee","Medium","","Milk","250","ml","ADD","size-specific milk"),
  @("Latte","Hot Coffee","Large","","Milk","320","ml","ADD","size-specific milk"),
  @("Iced Latte","Iced Coffee","Medium","Extra Shot","Coffee Beans","9","g","ADD","add-on adds beans"),
  @("Iced Latte","Iced Coffee","Medium","Vanilla Syrup","Vanilla Syrup","15","ml","ADD","add-on adds syrup"),
  @("Iced Latte","Iced Coffee","Medium","Oat Milk","Oat Milk","250","ml","REPLACE","replaces regular milk (single-select Milk group)"),
  @("Iced Tea","Iced Tea","Medium","Boba","Boba Pearls","40","g","ADD","")
)
Add-Sheet "B - Recipes" $bH $bR @() | Out-Null

$cH = @("Product Name","Product Type","Current Quantity","Minimum Quantity","Cost per Unit","Supplier","Expiry Date","Notes")
$cR = @(
  @("Croissant","Cafe","30","5","0.50","Bakery Co","2026-07-15",""),
  @("Brownie","Cafe","20","4","0.60","Bakery Co","",""),
  @("Chicken Sandwich","Cafe","15","3","1.20","","2026-07-14","cold sandwich"),
  @("Caesar Salad","Cafe","10","2","1.50","","2026-07-14",""),
  @("Water Bottle 500ml","Cafe","200","40","0.30","","",""),
  @("Illy Capsules Classico","Retail","40","10","8.00","Illy Dist","",""),
  @("Illy Coffee Machine X1","Retail","5","1","180.00","Illy Dist","","")
)
Add-Sheet "C - Products" $cH $cR @(7) | Out-Null

$dH = @("Date","Doughnut Name","Hanson Category","Quantity Produced","Cost per Piece (optional)","Notes")
$dR = @(
  @("2026-07-13","Boston Cream","Regular","12","0.80",""),
  @("2026-07-13","Chocolate Glazed","Regular","18","0.70",""),
  @("2026-07-13","Pistachio Cream","Special","8","1.20",""),
  @("2026-07-13","Birthday Creation","Creation","6","1.50","")
)
Add-Sheet "D - Hanson Daily" $dH $dR @(1) | Out-Null

foreach ($sh in @($wb.Worksheets)) {
  if ($sh.Name -like "Sheet*") { $sh.Delete() }
}
$wb.Worksheets.Item("Instructions").Move($wb.Worksheets.Item(1))

$wb.SaveAs($outFile, 51)
$wb.Close($false)
$xl.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Output "SAVED: $outFile"
