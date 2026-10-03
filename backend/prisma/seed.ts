import { PrismaClient, Temperature, DerivationType, StaffRole, OrderStatus, PrepStatus, DeliveryStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// "Today" for seeding purposes - kitchen is Asia/Kolkata (no DST, UTC+5:30).
// Stored dates are plain calendar dates (midnight UTC), consistent with how
// the rest of the app stores deliveryDate (see README on timezones).
function todayDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('Seeding Fernleaf Kitchen...');
  const today = todayDateString();
  console.log('Treating today as:', today);

  // ── Settings ──────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: 'CUTOFF_DAYS' }, create: { key: 'CUTOFF_DAYS', value: '2' }, update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'CUTOFF_TIME' }, create: { key: 'CUTOFF_TIME', value: '16:00' }, update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'KITCHEN_WORKING_DAYS' }, create: { key: 'KITCHEN_WORKING_DAYS', value: '[1,2,3,4,5]' }, update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'KITCHEN_HOLIDAYS' }, create: { key: 'KITCHEN_HOLIDAYS', value: '[]' }, update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'KITCHEN_TIMEZONE' }, create: { key: 'KITCHEN_TIMEZONE', value: 'Asia/Kolkata' }, update: {},
  });

  // ── Reference data ────────────────────────────────────────────────
  const allergenNames = ['Peanuts', 'Tree Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs'];
  const allergens = await Promise.all(
    allergenNames.map((name) => prisma.allergen.upsert({ where: { name }, create: { name }, update: {} })),
  );
  const [peanuts, treeNuts, dairy, gluten, soy, eggs] = allergens;

  const tagNames = ['Vegan', 'Vegetarian', 'Jain', 'Gluten-Free'];
  const tags = await Promise.all(
    tagNames.map((name) => prisma.dietaryTag.upsert({ where: { name }, create: { name }, update: {} })),
  );
  const [vegan, vegetarian, jain, glutenFree] = tags;

  const stationNames = ['Grill', 'Salad', 'Bakery', 'Beverage'];
  const stations = await Promise.all(
    stationNames.map((name) => prisma.kitchenStation.upsert({ where: { name }, create: { name }, update: {} })),
  );
  const [grill, salad, bakery, beverage] = stations;

  const [regular, large] = await Promise.all([
    prisma.portionSize.upsert({ where: { name: 'Regular' }, create: { name: 'Regular', order: 0 }, update: {} }),
    prisma.portionSize.upsert({ where: { name: 'Large' }, create: { name: 'Large', order: 1 }, update: {} }),
  ]);

  // ── Options ───────────────────────────────────────────────────────
  const paneer = await prisma.option.create({ data: { name: 'Paneer', costPrice: 25, dietaryTags: { create: [{ dietaryTagId: vegetarian.id }] } } });
  const tofu = await prisma.option.create({ data: { name: 'Tofu', costPrice: 22, dietaryTags: { create: [{ dietaryTagId: vegan.id }, { dietaryTagId: vegetarian.id }] }, allergens: { create: [{ allergenId: soy.id }] } } });
  const chickpeas = await prisma.option.create({ data: { name: 'Chickpeas', costPrice: 15, dietaryTags: { create: [{ dietaryTagId: vegan.id }, { dietaryTagId: vegetarian.id }, { dietaryTagId: jain.id }] } } });
  const brownRice = await prisma.option.create({ data: { name: 'Brown Rice', costPrice: 10, dietaryTags: { create: [{ dietaryTagId: vegan.id }] } } });
  const jeeraRice = await prisma.option.create({ data: { name: 'Jeera Rice', costPrice: 12, dietaryTags: { create: [{ dietaryTagId: vegan.id }] } } });
  const raita = await prisma.option.create({ data: { name: 'Raita', costPrice: 8, allergens: { create: [{ allergenId: dairy.id }] }, dietaryTags: { create: [{ dietaryTagId: vegetarian.id }] } } });
  const mintChutney = await prisma.option.create({ data: { name: 'Mint Chutney', costPrice: 5, dietaryTags: { create: [{ dietaryTagId: vegan.id }] } } });

  // ── Dishes ────────────────────────────────────────────────────────
  const bowlDish = await prisma.dish.create({
    data: {
      sku: 'BWL-001', name: 'Protein Rice Bowl', description: 'Choose your protein, rice and side.',
      temperature: Temperature.HOT, costPrice: 60, stationId: grill.id,
      dietaryTags: { create: [{ dietaryTagId: vegetarian.id }] },
      optionGroups: {
        create: [
          { name: 'Choose your protein', required: true, displayOrder: 0, options: { create: [{ optionId: paneer.id, displayOrder: 0 }, { optionId: tofu.id, displayOrder: 1 }, { optionId: chickpeas.id, displayOrder: 2 }] } },
          { name: 'Choose your rice', required: true, displayOrder: 1, options: { create: [{ optionId: brownRice.id, displayOrder: 0 }, { optionId: jeeraRice.id, displayOrder: 1 }] } },
          { name: 'Add a side', required: false, displayOrder: 2, options: { create: [{ optionId: raita.id, displayOrder: 0 }, { optionId: mintChutney.id, displayOrder: 1 }] } },
        ],
      },
    },
  });

  const saladDish = await prisma.dish.create({
    data: {
      sku: 'SAL-001', name: 'Garden Fresh Salad', description: 'Crisp greens, light dressing.',
      temperature: Temperature.COLD, costPrice: 45, stationId: salad.id,
      dietaryTags: { create: [{ dietaryTagId: vegan.id }, { dietaryTagId: glutenFree.id }] },
    },
  });

  const sandwichDish = await prisma.dish.create({
    data: {
      sku: 'SND-001', name: 'Grilled Veg Sandwich', description: 'Grilled vegetables on multigrain bread.',
      temperature: Temperature.HOT, costPrice: 50, stationId: grill.id,
      allergens: { create: [{ allergenId: gluten.id }, { allergenId: dairy.id }] },
      dietaryTags: { create: [{ dietaryTagId: vegetarian.id }] },
    },
  });

  const breakfastDish = await prisma.dish.create({
    data: {
      sku: 'BRK-001', name: 'Masala Omelette Wrap', description: 'Spiced omelette, wrapped and ready.',
      temperature: Temperature.HOT, costPrice: 40, stationId: grill.id,
      allergens: { create: [{ allergenId: eggs.id }, { allergenId: gluten.id }] },
    },
  });

  const dessertDish = await prisma.dish.create({
    data: {
      sku: 'DES-001', name: 'Chocolate Brownie', description: 'Rich, fudgy, baked fresh.',
      temperature: Temperature.COLD, costPrice: 35, stationId: bakery.id,
      allergens: { create: [{ allergenId: gluten.id }, { allergenId: dairy.id }, { allergenId: eggs.id }] },
      dietaryTags: { create: [{ dietaryTagId: vegetarian.id }] },
    },
  });

  const juiceDish = await prisma.dish.create({
    data: {
      sku: 'BEV-001', name: 'Fresh Fruit Juice', description: 'Seasonal fruit, no added sugar.',
      temperature: Temperature.COLD, costPrice: 20, stationId: beverage.id,
      dietaryTags: { create: [{ dietaryTagId: vegan.id }, { dietaryTagId: glutenFree.id }] },
    },
  });

  // Deactivated dish, to prove historical orders still reference it correctly (4.1).
  const retiredDish = await prisma.dish.create({
    data: { sku: 'OLD-001', name: 'Retired Pasta Bowl', temperature: Temperature.HOT, costPrice: 55, active: false },
  });

  // ── Menu categories ───────────────────────────────────────────────
  const bowlsCategory = await prisma.category.create({ data: { name: 'Bowls', displayOrder: 0 } });
  const lightCategory = await prisma.category.create({ data: { name: 'Light Bites', displayOrder: 1 } });
  const breakfastCategory = await prisma.category.create({ data: { name: 'Breakfast', displayOrder: 2 } });
  const dessertsCategory = await prisma.category.create({ data: { name: 'Desserts', displayOrder: 3 } });
  const secretCategory = await prisma.category.create({ data: { name: 'Chef Specials', displayOrder: 4, secret: true } });

  await prisma.categoryItem.create({ data: { categoryId: bowlsCategory.id, dishId: bowlDish.id, displayOrder: 0 } });
  await prisma.categoryItem.create({ data: { categoryId: lightCategory.id, dishId: saladDish.id, displayOrder: 0 } });
  await prisma.categoryItem.create({ data: { categoryId: lightCategory.id, dishId: sandwichDish.id, displayOrder: 1 } });
  await prisma.categoryItem.create({ data: { categoryId: lightCategory.id, dishId: juiceDish.id, displayOrder: 2 } });
  await prisma.categoryItem.create({ data: { categoryId: breakfastCategory.id, dishId: breakfastDish.id, displayOrder: 0 } });
  await prisma.categoryItem.create({ data: { categoryId: dessertsCategory.id, dishId: dessertDish.id, displayOrder: 0 } });
  await prisma.categoryItem.create({ data: { categoryId: secretCategory.id, dishId: dessertDish.id, displayOrder: 0 } });

  // ── Price tiers ───────────────────────────────────────────────────
  const standardTier = await prisma.priceTier.create({ data: { name: 'Standard', isDefault: true } });
  const enterpriseTier = await prisma.priceTier.create({ data: { name: 'Enterprise' } }); // derives from Standard + markup
  const partnerTier = await prisma.priceTier.create({ data: { name: 'Partner' } }); // derives from cost x multiplier

  const dishes = [bowlDish, saladDish, sandwichDish, breakfastDish, dessertDish, juiceDish];
  const explicitStandardPrices: Record<string, number> = {
    [bowlDish.id]: 150, [saladDish.id]: 110, [sandwichDish.id]: 120, [breakfastDish.id]: 95, [dessertDish.id]: 85, [juiceDish.id]: 60,
  };
  for (const dish of dishes) {
    await prisma.dishPrice.create({
      data: { dishId: dish.id, priceTierId: standardTier.id, explicitPrice: explicitStandardPrices[dish.id], derivation: DerivationType.NONE },
    });
    await prisma.dishPrice.create({
      data: { dishId: dish.id, priceTierId: enterpriseTier.id, derivation: DerivationType.MARKUP_PERCENT, derivationValue: 15 },
    });
    await prisma.dishPrice.create({
      data: { dishId: dish.id, priceTierId: partnerTier.id, derivation: DerivationType.COST_MULTIPLIER, derivationValue: 2.4 },
    });
  }
  // Intentionally leave the retired dish with NO price on any tier - proves
  // the "no price => excluded from menu" rule (4.3.5) without needing an
  // active dish to demonstrate it.

  const options = [paneer, tofu, chickpeas, brownRice, jeeraRice, raita, mintChutney];
  const explicitOptionPrices: Record<string, number> = {
    [paneer.id]: 30, [tofu.id]: 28, [chickpeas.id]: 18, [brownRice.id]: 12, [jeeraRice.id]: 15, [raita.id]: 10, [mintChutney.id]: 6,
  };
  for (const option of options) {
    await prisma.optionPrice.create({
      data: { optionId: option.id, priceTierId: standardTier.id, explicitPrice: explicitOptionPrices[option.id], derivation: DerivationType.NONE },
    });
    await prisma.optionPrice.create({
      data: { optionId: option.id, priceTierId: enterpriseTier.id, derivation: DerivationType.MARKUP_PERCENT, derivationValue: 15 },
    });
    await prisma.optionPrice.create({
      data: { optionId: option.id, priceTierId: partnerTier.id, derivation: DerivationType.COST_MULTIPLIER, derivationValue: 2.4 },
    });
  }

  // ── Staff accounts (the 4 required test accounts, exact credentials) ──
  const passwordHash = await bcrypt.hash('Test@1234', 10);
  const adminStaff = await prisma.staff.create({ data: { email: 'admin@test.com', password: passwordHash, name: 'Asha Admin', role: StaffRole.ADMIN } });
  const kitchenStaff = await prisma.staff.create({ data: { email: 'kitchen@test.com', password: passwordHash, name: 'Kiran Kitchen', role: StaffRole.KITCHEN } });
  const dispatchStaff = await prisma.staff.create({ data: { email: 'dispatch@test.com', password: passwordHash, name: 'Divya Dispatch', role: StaffRole.DISPATCH } });
  const driverStaff = await prisma.staff.create({ data: { email: 'driver@test.com', password: passwordHash, name: 'Dev Driver', role: StaffRole.DRIVER } });
  // A second driver so dispatch assignment has a real choice to make.
  const driver2 = await prisma.staff.create({ data: { email: 'driver2@test.com', password: passwordHash, name: 'Priya Driver', role: StaffRole.DRIVER } });

  console.log('Created staff accounts:', [adminStaff, kitchenStaff, dispatchStaff, driverStaff, driver2].map((s) => s.email));

  // ── Companies ─────────────────────────────────────────────────────
  const acme = await prisma.company.create({
    data: {
      name: 'Acme Logistics', priceTierId: standardTier.id, defaultDeliveryTime: '13:00',
      dispatchLeadMinutes: 60, defaultPackagingType: 'Standard box', defaultDriverId: driverStaff.id,
      workingDays: [1, 2, 3, 4, 5],
      domains: { create: [{ domain: 'acmelogistics.com' }] },
      addresses: { create: [{ label: 'Head Office', line1: '221 Industrial Rd', city: 'Ahmedabad', state: 'Gujarat', postalCode: '380001' }] },
    },
    include: { addresses: true },
  });

  const northwind = await prisma.company.create({
    data: {
      name: 'Northwind Traders', priceTierId: enterpriseTier.id, defaultDeliveryTime: '12:30',
      dispatchLeadMinutes: 45, defaultPackagingType: 'Eco box', defaultDriverId: driver2.id,
      workingDays: [1, 2, 3, 4, 5],
      domains: { create: [{ domain: 'northwindtraders.com' }] },
      addresses: { create: [{ label: 'Main Campus', line1: '45 Business Park', city: 'Gandhinagar', state: 'Gujarat', postalCode: '382010' }] },
    },
    include: { addresses: true },
  });

  const globex = await prisma.company.create({
    data: {
      name: 'Globex Partners', priceTierId: partnerTier.id, defaultDeliveryTime: '13:30',
      dispatchLeadMinutes: 60, defaultPackagingType: 'Standard box', defaultDriverId: driverStaff.id,
      workingDays: [1, 2, 3, 4, 5],
      domains: { create: [{ domain: 'globexpartners.com' }] },
      addresses: { create: [{ label: 'Tower A', line1: '9 Corporate Blvd', city: 'Ahmedabad', state: 'Gujarat', postalCode: '380015' }] },
    },
    include: { addresses: true },
  });

  // A kitchen holiday + a company holiday, to exercise cut-off skip logic.
  await prisma.companyHoliday.create({ data: { companyId: acme.id, date: new Date(addDays(today, 5)) } });

  // ── Employees ─────────────────────────────────────────────────────
  const acmeEmp1 = await prisma.employee.create({ data: { companyId: acme.id, name: 'Rahul Shah', email: 'rahul.shah@acmelogistics.com', canChooseAddress: true, canChangeTime: false, canChangePackaging: false, allergies: { create: [{ allergenId: peanuts.id }] } } });
  const acmeEmp2 = await prisma.employee.create({ data: { companyId: acme.id, name: 'Priyanka Mehta', email: 'priyanka.mehta@acmelogistics.com', canChooseAddress: false, canChangeTime: false, canChangePackaging: false, dietaryPreferences: { create: [{ dietaryTagId: vegetarian.id }] } } });
  const nwEmp1 = await prisma.employee.create({ data: { companyId: northwind.id, name: 'Sahil Verma', email: 'sahil.verma@northwindtraders.com', canChooseAddress: true, canChangeTime: true, canChangePackaging: false } });
  const nwEmp2 = await prisma.employee.create({ data: { companyId: northwind.id, name: 'Aditi Rao', email: 'aditi.rao@northwindtraders.com', canChooseAddress: true, canChangeTime: false, canChangePackaging: true, dietaryPreferences: { create: [{ dietaryTagId: vegan.id }] } } });
  const globexEmp1 = await prisma.employee.create({ data: { companyId: globex.id, name: 'Karan Patel', email: 'karan.patel@globexpartners.com', canChooseAddress: true, canChangeTime: false, canChangePackaging: false } });

  await prisma.company.update({ where: { id: acme.id }, data: { ownerEmployeeId: acmeEmp1.id } });
  await prisma.company.update({ where: { id: northwind.id }, data: { ownerEmployeeId: nwEmp1.id } });
  await prisma.company.update({ where: { id: globex.id }, data: { ownerEmployeeId: globexEmp1.id } });

  console.log('Created companies and employees');

  // ── Orders: a realistic spread across past, today, and future dates ──
  // Helper to build a simple one-line order (no options) for bulk seeding.
  async function createSimpleOrder(opts: {
    employeeId: string; companyId: string; addressId: string; deliveryDate: string; deliveryTime: string;
    dishId: string; quantity: number; unitPrice: number; status: OrderStatus;
  }) {
    const order = await prisma.order.create({
      data: {
        employeeId: opts.employeeId, companyId: opts.companyId, addressId: opts.addressId,
        deliveryDate: new Date(opts.deliveryDate), deliveryTime: opts.deliveryTime, status: opts.status,
        statusHistory: { create: { status: opts.status } },
        lines: {
          create: [{
            dishId: opts.dishId, quantity: opts.quantity, unitPriceSnapshot: opts.unitPrice,
            combinations: { create: [{ quantity: opts.quantity, totalPriceSnapshot: opts.unitPrice * opts.quantity }] },
          }],
        },
      },
      include: { lines: { include: { combinations: true } } },
    });
    return order;
  }

  // Past orders (already delivered) - several days back.
  for (let i = 1; i <= 4; i++) {
    const date = addDays(today, -i);
    await createSimpleOrder({ employeeId: acmeEmp1.id, companyId: acme.id, addressId: acme.addresses[0].id, deliveryDate: date, deliveryTime: '13:00', dishId: bowlDish.id, quantity: 2, unitPrice: 150, status: OrderStatus.DELIVERED });
    await createSimpleOrder({ employeeId: nwEmp1.id, companyId: northwind.id, addressId: northwind.addresses[0].id, deliveryDate: date, deliveryTime: '12:30', dishId: saladDish.id, quantity: 1, unitPrice: 126.5, status: OrderStatus.DELIVERED });
  }

  // Yesterday: a cancelled and a rejected order, for status variety.
  const yesterday = addDays(today, -1);
  await createSimpleOrder({ employeeId: globexEmp1.id, companyId: globex.id, addressId: globex.addresses[0].id, deliveryDate: yesterday, deliveryTime: '13:30', dishId: sandwichDish.id, quantity: 1, unitPrice: 120, status: OrderStatus.CANCELLED });
  await createSimpleOrder({ employeeId: acmeEmp2.id, companyId: acme.id, addressId: acme.addresses[0].id, deliveryDate: yesterday, deliveryTime: '13:00', dishId: breakfastDish.id, quantity: 1, unitPrice: 95, status: OrderStatus.REJECTED });

  // Today: confirmed orders with full kitchen/dispatch pipeline seeded manually.
  const todayOrder1 = await createSimpleOrder({ employeeId: acmeEmp1.id, companyId: acme.id, addressId: acme.addresses[0].id, deliveryDate: today, deliveryTime: '13:00', dishId: bowlDish.id, quantity: 3, unitPrice: 150, status: OrderStatus.CONFIRMED });
  const todayOrder2 = await createSimpleOrder({ employeeId: acmeEmp2.id, companyId: acme.id, addressId: acme.addresses[0].id, deliveryDate: today, deliveryTime: '13:00', dishId: saladDish.id, quantity: 2, unitPrice: 110, status: OrderStatus.CONFIRMED });
  const todayOrder3 = await createSimpleOrder({ employeeId: nwEmp1.id, companyId: northwind.id, addressId: northwind.addresses[0].id, deliveryDate: today, deliveryTime: '12:30', dishId: sandwichDish.id, quantity: 1, unitPrice: 138, status: OrderStatus.CONFIRMED });
  const todayOrder4 = await createSimpleOrder({ employeeId: nwEmp2.id, companyId: northwind.id, addressId: northwind.addresses[0].id, deliveryDate: today, deliveryTime: '12:30', dishId: dessertDish.id, quantity: 4, unitPrice: 97.75, status: OrderStatus.CONFIRMED });
  const todayOrder5 = await createSimpleOrder({ employeeId: globexEmp1.id, companyId: globex.id, addressId: globex.addresses[0].id, deliveryDate: today, deliveryTime: '13:30', dishId: juiceDish.id, quantity: 2, unitPrice: 48, status: OrderStatus.CONFIRMED });

  // Compute planned kitchen/dispatch times for today's orders (normally done
  // by OrdersService.create, but these were seeded directly via Prisma).
  async function setPlannedTimes(order: { id: string; deliveryTime: string }, dispatchLeadMinutes: number) {
    const [hour, minute] = order.deliveryTime.split(':').map(Number);
    const deliveryInstant = new Date(today + 'T00:00:00Z');
    deliveryInstant.setUTCHours(hour - 5, minute - 30, 0, 0); // crude IST->UTC shift for seed purposes
    const dispatchReadyAt = new Date(deliveryInstant.getTime() - dispatchLeadMinutes * 60000);
    const kitchenReadyAt = new Date(dispatchReadyAt.getTime() - 30 * 60000);
    await prisma.order.update({ where: { id: order.id }, data: { dispatchReadyAt, kitchenReadyAt } });
  }
  await setPlannedTimes(todayOrder1, 60);
  await setPlannedTimes(todayOrder2, 60);
  await setPlannedTimes(todayOrder3, 45);
  await setPlannedTimes(todayOrder4, 45);
  await setPlannedTimes(todayOrder5, 60);

  // Seed PrepUnits for today's confirmed orders (normally created by cut-off
  // processing; done directly here since these orders were seeded already-confirmed).
  const todayOrders = [todayOrder1, todayOrder2, todayOrder3, todayOrder4, todayOrder5];
  for (const order of todayOrders) {
    for (const line of order.lines) {
      for (const combo of line.combinations) {
        await prisma.prepUnit.create({ data: { combinationId: combo.id, status: PrepStatus.PENDING } });
      }
    }
  }

  // Mark order 1 and 2's prep units as done, to show a partially-cooked kitchen board.
  const order1Units = await prisma.prepUnit.findMany({ where: { combination: { orderLine: { orderId: todayOrder1.id } } } });
  for (const unit of order1Units) {
    await prisma.prepUnit.update({ where: { id: unit.id }, data: { status: PrepStatus.DONE, startedAt: new Date(), doneAt: new Date() } });
  }
  await prisma.order.update({ where: { id: todayOrder1.id }, data: { kitchenStartedAt: new Date(), kitchenReadyActualAt: new Date() } });

  const order2Units = await prisma.prepUnit.findMany({ where: { combination: { orderLine: { orderId: todayOrder2.id } } } });
  if (order2Units[0]) {
    await prisma.prepUnit.update({ where: { id: order2Units[0].id }, data: { status: PrepStatus.STARTED, startedAt: new Date() } });
    await prisma.order.update({ where: { id: todayOrder2.id }, data: { kitchenStartedAt: new Date() } });
  }

  // Deliveries for today, assigned to driver@test.com (explicit requirement).
  const delivery1 = await prisma.delivery.create({ data: { orderId: todayOrder1.id, status: DeliveryStatus.KITCHEN_READY, driverId: driverStaff.id } });
  const delivery2 = await prisma.delivery.create({ data: { orderId: todayOrder2.id, status: DeliveryStatus.DISPATCH_READY, driverId: driverStaff.id, dispatchReadyAt: new Date() } });
  await prisma.delivery.create({ data: { orderId: todayOrder3.id, status: DeliveryStatus.KITCHEN_READY, driverId: driver2.id } });
  await prisma.delivery.create({ data: { orderId: todayOrder4.id, status: DeliveryStatus.KITCHEN_READY, driverId: driver2.id } });
  // One unassigned delivery, to show dispatch board's "unassigned" state.
  await prisma.delivery.create({ data: { orderId: todayOrder5.id, status: DeliveryStatus.KITCHEN_READY } });

  // Future: placed and draft orders for the coming week, to exercise cut-off.
  for (let i = 1; i <= 6; i++) {
    const date = addDays(today, i);
    await createSimpleOrder({ employeeId: acmeEmp1.id, companyId: acme.id, addressId: acme.addresses[0].id, deliveryDate: date, deliveryTime: '13:00', dishId: bowlDish.id, quantity: 1, unitPrice: 150, status: OrderStatus.PLACED });
    if (i % 2 === 0) {
      await createSimpleOrder({ employeeId: globexEmp1.id, companyId: globex.id, addressId: globex.addresses[0].id, deliveryDate: date, deliveryTime: '13:30', dishId: dessertDish.id, quantity: 2, unitPrice: 97.75, status: OrderStatus.DRAFT });
    }
  }

  console.log('Created orders across past, today, and future dates');

  // ── Cut-off processing for a past date (idempotency demo) ──────────
  // Run it twice to prove the second run is a safe no-op (4.6).
  await prisma.cutoffRun.upsert({
    where: { deliveryDate: new Date(yesterday) },
    create: { deliveryDate: new Date(yesterday), draftsCancelled: 0, ordersConfirmed: 0 },
    update: {},
  });

  // ── An invoice for some of the delivered past orders (4.9 demo) ─────
  const deliveredAcmeOrders = await prisma.order.findMany({
    where: { companyId: acme.id, status: OrderStatus.DELIVERED, invoiceId: null },
    include: { lines: { include: { combinations: true } } },
  });
  if (deliveredAcmeOrders.length > 0) {
    const total = deliveredAcmeOrders.reduce(
      (sum, o) => sum + o.lines.reduce((s, l) => s + l.combinations.reduce((cs, c) => cs + Number(c.totalPriceSnapshot), 0), 0),
      0,
    );
    await prisma.invoice.create({
      data: {
        companyId: acme.id, total, paid: true, paidAt: new Date(),
        orders: { connect: deliveredAcmeOrders.map((o) => ({ id: o.id })) },
      },
    });
    console.log(`Created and paid an invoice for ${deliveredAcmeOrders.length} Acme orders, total ${total}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
