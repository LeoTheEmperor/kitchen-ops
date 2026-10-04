-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'KITCHEN', 'DISPATCH', 'DRIVER');

-- CreateEnum
CREATE TYPE "Temperature" AS ENUM ('HOT', 'COLD');

-- CreateEnum
CREATE TYPE "DerivationType" AS ENUM ('NONE', 'COST_MULTIPLIER', 'MARKUP_PERCENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrepStatus" AS ENUM ('PENDING', 'STARTED', 'DONE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DietaryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortionSize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PortionSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "temperature" "Temperature" NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "minOrderQty" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishAllergen" (
    "dishId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "DishAllergen_pkey" PRIMARY KEY ("dishId","allergenId")
);

-- CreateTable
CREATE TABLE "DishDietaryTag" (
    "dishId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "DishDietaryTag_pkey" PRIMARY KEY ("dishId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "OptionGroup" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "usesPortions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionAllergen" (
    "optionId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "OptionAllergen_pkey" PRIMARY KEY ("optionId","allergenId")
);

-- CreateTable
CREATE TABLE "OptionDietaryTag" (
    "optionId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "OptionDietaryTag_pkey" PRIMARY KEY ("optionId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "OptionGroupItem" (
    "id" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionPortion" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "portionSizeId" TEXT NOT NULL,
    "extraCharge" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OptionPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCompanyHidden" (
    "categoryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CategoryCompanyHidden_pkey" PRIMARY KEY ("categoryId","companyId")
);

-- CreateTable
CREATE TABLE "CategoryItemCompanyHidden" (
    "categoryItemId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CategoryItemCompanyHidden_pkey" PRIMARY KEY ("categoryItemId","companyId")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishPrice" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "priceTierId" TEXT NOT NULL,
    "explicitPrice" DECIMAL(10,2),
    "derivation" "DerivationType" NOT NULL DEFAULT 'NONE',
    "derivationValue" DECIMAL(10,4),

    CONSTRAINT "DishPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionPrice" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "priceTierId" TEXT NOT NULL,
    "explicitPrice" DECIMAL(10,2),
    "derivation" "DerivationType" NOT NULL DEFAULT 'NONE',
    "derivationValue" DECIMAL(10,4),

    CONSTRAINT "OptionPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceTierId" TEXT,
    "ownerEmployeeId" TEXT,
    "defaultDeliveryTime" TEXT,
    "dispatchLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultPackagingType" TEXT,
    "driverInstructions" TEXT,
    "defaultDriverId" TEXT,
    "workingDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDomain" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "CompanyDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,

    CONSTRAINT "CompanyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "canChooseAddress" BOOLEAN NOT NULL DEFAULT true,
    "canChangeTime" BOOLEAN NOT NULL DEFAULT false,
    "canChangePackaging" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAllergy" (
    "employeeId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "EmployeeAllergy_pkey" PRIMARY KEY ("employeeId","allergenId")
);

-- CreateTable
CREATE TABLE "EmployeeDietaryTag" (
    "employeeId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "EmployeeDietaryTag_pkey" PRIMARY KEY ("employeeId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "packagingType" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatchReadyAt" TIMESTAMP(3),
    "kitchenReadyAt" TIMESTAMP(3),
    "kitchenStartedAt" TIMESTAMP(3),
    "kitchenReadyActualAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineCombination" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPriceSnapshot" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderLineCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineCombinationOption" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "optionNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderLineCombinationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CutoffRun" (
    "id" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftsCancelled" INTEGER NOT NULL,
    "ordersConfirmed" INTEGER NOT NULL,

    CONSTRAINT "CutoffRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepUnit" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "status" "PrepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "PrepUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'KITCHEN_READY',
    "driverId" TEXT,
    "dispatchReadyAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "onTime" BOOLEAN,
    "deliveryNote" TEXT,
    "deliveryPhotoUrl" TEXT,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_CompanyStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_name_key" ON "Allergen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_name_key" ON "DietaryTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_name_key" ON "KitchenStation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PortionSize_name_key" ON "PortionSize"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Dish_sku_key" ON "Dish"("sku");

-- CreateIndex
CREATE INDEX "OptionGroup_dishId_idx" ON "OptionGroup"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionGroupItem_optionGroupId_optionId_key" ON "OptionGroupItem"("optionGroupId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPortion_optionId_portionSizeId_key" ON "OptionPortion"("optionId", "portionSizeId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryItem_categoryId_dishId_key" ON "CategoryItem"("categoryId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_name_key" ON "PriceTier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DishPrice_dishId_priceTierId_key" ON "DishPrice"("dishId", "priceTierId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPrice_optionId_priceTierId_key" ON "OptionPrice"("optionId", "priceTierId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerEmployeeId_key" ON "Company"("ownerEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDomain_domain_key" ON "CompanyDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_companyId_date_key" ON "CompanyHoliday"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_status_idx" ON "Order"("deliveryDate", "status");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLineCombination_orderLineId_idx" ON "OrderLineCombination"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderLineCombinationOption_combinationId_idx" ON "OrderLineCombinationOption"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "CutoffRun_deliveryDate_key" ON "CutoffRun"("deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PrepUnit_combinationId_key" ON "PrepUnit"("combinationId");

-- CreateIndex
CREATE INDEX "PrepUnit_status_idx" ON "PrepUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_driverId_idx" ON "Delivery"("driverId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyStaff_AB_unique" ON "_CompanyStaff"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyStaff_B_index" ON "_CompanyStaff"("B");

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishDietaryTag" ADD CONSTRAINT "DishDietaryTag_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishDietaryTag" ADD CONSTRAINT "DishDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAllergen" ADD CONSTRAINT "OptionAllergen_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAllergen" ADD CONSTRAINT "OptionAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionDietaryTag" ADD CONSTRAINT "OptionDietaryTag_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionDietaryTag" ADD CONSTRAINT "OptionDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupItem" ADD CONSTRAINT "OptionGroupItem_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "OptionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupItem" ADD CONSTRAINT "OptionGroupItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPortion" ADD CONSTRAINT "OptionPortion_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPortion" ADD CONSTRAINT "OptionPortion_portionSizeId_fkey" FOREIGN KEY ("portionSizeId") REFERENCES "PortionSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryItem" ADD CONSTRAINT "CategoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryItem" ADD CONSTRAINT "CategoryItem_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCompanyHidden" ADD CONSTRAINT "CategoryCompanyHidden_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCompanyHidden" ADD CONSTRAINT "CategoryCompanyHidden_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryItemCompanyHidden" ADD CONSTRAINT "CategoryItemCompanyHidden_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "CategoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryItemCompanyHidden" ADD CONSTRAINT "CategoryItemCompanyHidden_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishPrice" ADD CONSTRAINT "DishPrice_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishPrice" ADD CONSTRAINT "DishPrice_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPrice" ADD CONSTRAINT "OptionPrice_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPrice" ADD CONSTRAINT "OptionPrice_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDomain" ADD CONSTRAINT "CompanyDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAddress" ADD CONSTRAINT "CompanyAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyHoliday" ADD CONSTRAINT "CompanyHoliday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAllergy" ADD CONSTRAINT "EmployeeAllergy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAllergy" ADD CONSTRAINT "EmployeeAllergy_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDietaryTag" ADD CONSTRAINT "EmployeeDietaryTag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDietaryTag" ADD CONSTRAINT "EmployeeDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "CompanyAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineCombination" ADD CONSTRAINT "OrderLineCombination_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineCombinationOption" ADD CONSTRAINT "OrderLineCombinationOption_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "OrderLineCombination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepUnit" ADD CONSTRAINT "PrepUnit_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "OrderLineCombination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyStaff" ADD CONSTRAINT "_CompanyStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyStaff" ADD CONSTRAINT "_CompanyStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
