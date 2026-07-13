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

$insHeaders = @("Topic", "Explanation")
$insRows = @(
  @("HOW TO USE", "Fill the 4 tabs, then import them in Admin > Inventory > Import (one tab at a time or the whole workbook). Nothing is saved until you review the validation screen."),
  @("UNITS - USE BASE UNITS ONLY", "Only use g (grams), ml (millilitres), pc (pieces). Convert kg to g and litres to ml - the system does NOT auto-convert."),
  @("UNIT EXAMPLES", "1 kg coffee beans  =  1000 g   |   1 litre milk  =  1000 ml   |   1 box of cups  =  the number of pieces, e.g. 500 pc"),
  @("NAMES MUST MATCH", "In the Recipes tab, 'Inventory Item Used' and 'Replaces Inventory Item' must match an Item Name in the Current Stock tab exactly, and 'Menu Item' must match a product in the Menu Manager exactly. The importer warns about mismatches before saving."),
  @("SIZE column", "Blank = the recipe line applies to ALL sizes. Or put Small / Medium / Large to make that line size-specific."),
  @("ADD-ON column", "Blank = base recipe (always deducted). Put an add-on name = only deducted when that add-on is chosen."),
  @("DEDUCTION RULE - ADD", "ADD means the ingredient is added ON TOP of the normal recipe (extra shot, syrup, boba)."),
  @("DEDUCTION RULE - REPLACE", "REPLACE means this ingredient replaces another one. Put the replaced item in the 'Replaces Inventory Item' column. Example: a regular latte uses Milk; if the customer chooses Oat Milk, oat milk REPLACES milk, so regular milk is NOT deducted (Oat Milk 250 ml, Rule=REPLACE, Replaces=Milk)."),
  @("REPLACES INVENTORY ITEM", "Only used on REPLACE rows - the base ingredient being swapped out. Leave blank on all normal / ADD rows."),
  @("DATES", "Use format YYYY-MM-DD, e.g. 2026-12-31. Leave blank if not tracked."),
  @("STORAGE LOCATION (optional)", "Where the item is kept. Examples: Fridge, Freezer, Dry Storage, Bar, Kitchen, Display Fridge."),
  @("BATCH / LOT NUMBER (optional)", "Reference for a specific delivery batch, for tracing. Leave blank if you do not track batches."),
  @("HANSON - IMPORTANT", "Do NOT list daily Hanson doughnuts in the Products tab. Hanson daily stock is entered on the 'D - Hanson Daily' tab, one row per doughnut per day."),
  @("VALIDATION", "The importer shows errors like: 'Vanilla Syrup used in a recipe but missing from Current Stock', 'Iced Latte Medium not found in the menu', or 'Unit mismatch: recipe uses ml but item is tracked in g'. Fix them, then import.")
)
Add-Sheet "Instructions" $insHeaders $insRows @() | Out-Null

$aH = @("Item Name","Category","Unit","Current Qty","Min Qty","Cost/Unit","Supplier","Expiry Date","Track Expiry","Batch / Lot Number","Storage Location","Notes")
$aR = @(
  @("Milk","Dairy","ml","20000","5000","0.0012","Supplier A","","No","","Display Fridge","Enter ml, not litres"),
  @("Oat Milk","Dairy-Free","ml","8000","2000","0.0025","Supplier A","","No","","Display Fridge",""),
  @("Coffee Beans","Coffee","g","10000","2000","0.02","Supplier B","","No","","Dry Storage",""),
  @("Matcha Powder","Powders","g","1000","200","0.08","Supplier E","","No","","Dry Storage",""),
  @("Protein Powder","Powders","g","2000","300","0.05","","","No","","Dry Storage",""),
  @("Vanilla Syrup","Syrups","ml","3000","500","0.004","Supplier D","","No","","Bar",""),
  @("Boba Pearls","Toppings","g","2000","400","0.01","Supplier F","","No","","Dry Storage",""),
  @("Cup 16oz","Packaging","pc","500","100","0.05","Supplier C","","No","","Dry Storage",""),
  @("Lid 16oz","Packaging","pc","500","100","0.03","Supplier C","","No","","Dry Storage",""),
  @("Straw","Packaging","pc","1000","200","0.01","Supplier C","","No","","Bar",""),
  @("Water Bottle 500ml","Beverages","pc","200","40","0.30","","2026-12-31","Yes","LOT-2026-07","Display Fridge","")
)
Add-Sheet "A - Current Stock" $aH $aR @(8) | Out-Null

$bH = @("Menu Item","Menu Category","Size","Add-on","Inventory Item Used","Qty Used","Unit","Deduction Rule","Replaces Inventory Item","Notes")
$bR = @(
  @("Iced Latte","Iced Coffee","Medium","","Coffee Beans","18","g","ADD","","base recipe"),
  @("Iced Latte","Iced Coffee","Medium","","Milk","250","ml","ADD","",""),
  @("Iced Latte","Iced Coffee","Medium","","Cup 16oz","1","pc","ADD","",""),
  @("Iced Latte","Iced Coffee","Medium","","Lid 16oz","1","pc","ADD","",""),
  @("Iced Latte","Iced Coffee","Medium","","Straw","1","pc","ADD","",""),
  @("Latte","Hot Coffee","Small","","Milk","180","ml","ADD","","size-specific milk"),
  @("Latte","Hot Coffee","Medium","","Milk","250","ml","ADD","","size-specific milk"),
  @("Latte","Hot Coffee","Large","","Milk","320","ml","ADD","","size-specific milk"),
  @("Iced Latte","Iced Coffee","Medium","Extra Shot","Coffee Beans","9","g","ADD","","add-on adds beans"),
  @("Iced Latte","Iced Coffee","Medium","Vanilla Syrup","Vanilla Syrup","15","ml","ADD","","add-on adds syrup"),
  @("Iced Latte","Iced Coffee","Medium","Oat Milk","Oat Milk","250","ml","REPLACE","Milk","oat milk replaces regular milk"),
  @("Iced Tea","Iced Tea","Medium","Boba","Boba Pearls","40","g","ADD","","")
)
Add-Sheet "B - Recipes" $bH $bR @() | Out-Null

$cH = @("Product Name","Type","Current Qty","Min Qty","Cost","Supplier","Expiry Date","Notes")
$cR = @(
  @("Croissant","Cafe","30","5","0.50","Bakery Co","2026-07-15",""),
  @("Brownie","Cafe","20","4","0.60","Bakery Co","",""),
  @("Chocolate Muffin","Cafe","18","4","0.55","Bakery Co","2026-07-15",""),
  @("Chicken Sandwich","Cafe","15","3","1.20","","2026-07-14","cold sandwich"),
  @("Caesar Salad","Cafe","10","2","1.50","","2026-07-14",""),
  @("Water Bottle 500ml","Cafe","200","40","0.30","","",""),
  @("Illy Capsules Classico","Retail","40","10","8.00","Illy Dist","",""),
  @("Illy Coffee Machine X1","Retail","5","1","180.00","Illy Dist","",""),
  @("Illy Beans Bag 250g","Retail","25","6","6.50","Illy Dist","","")
)
Add-Sheet "C - Products" $cH $cR @(7) | Out-Null

$dH = @("Date","Doughnut","Category","Qty Produced","Cost/Piece","Available Today","Notes")
$dR = @(
  @("2026-07-13","Boston Cream","Regular","12","0.80","Yes",""),
  @("2026-07-13","Chocolate Glazed","Regular","18","0.70","Yes",""),
  @("2026-07-13","Pistachio Cream","Special","8","1.20","Yes",""),
  @("2026-07-13","Birthday Creation","Creation","6","1.50","No","reserved for an order")
)
Add-Sheet "D - Hanson Daily" $dH $dR @(1) | Out-Null

foreach ($sh in @($wb.Worksheets)) {
  if ($sh.Name -like "Sheet*") { $sh.Delete() }
}

$order = @("Instructions","A - Current Stock","B - Recipes","C - Products","D - Hanson Daily")
for ($i=0; $i -lt $order.Count; $i++) {
  if ($i -eq 0) { $wb.Worksheets.Item($order[$i]).Move($wb.Worksheets.Item(1)) }
  else { $wb.Worksheets.Item($order[$i]).Move([System.Type]::Missing, $wb.Worksheets.Item($order[$i-1])) }
}
$wb.Worksheets.Item(1).Activate()

$wb.SaveAs($outFile, 51)
$wb.Close($false)
$xl.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Output "SAVED: $outFile"
