document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

    // --- State Management (using localStorage) ---
    const DB = {
        get: (key) => JSON.parse(localStorage.getItem(key)) || [],
        set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    };

    let units = DB.get('units');
    let transactions = DB.get('transactions'); // {type: 'charge'/'payment'/'expense', ...}

    // --- DOM Elements ---
    const unitForm = document.getElementById('unit-form');
    const unitsTableBody = document.querySelector('#units-table tbody');
    const paymentUnitSelect = document.getElementById('payment-unit-select');

    const chargeForm = document.getElementById('charge-form');
    const paymentForm = document.getElementById('payment-form');
    const expenseForm = document.getElementById('expense-form');

    const debtorsTableBody = document.querySelector('#debtors-table tbody');
    const expensesTableBody = document.querySelector('#expenses-table tbody');
    
    const totalIncomeSpan = document.getElementById('total-income');
    const totalExpenseSpan = document.getElementById('total-expense');
    const fundBalanceSpan = document.getElementById('fund-balance');

    // --- Utility Functions ---
    const toPersianNum = (num) => num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const clearForm = (...forms) => forms.forEach(form => form.reset());

    // --- Rendering Functions ---
    const renderAll = () => {
        renderUnits();
        renderPaymentUnitSelect();
        renderReports();
        renderExpenses();
    };

    const renderUnits = () => {
        unitsTableBody.innerHTML = '';
        units.forEach(unit => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${toPersianNum(unit.number)}</td>
                <td>${toPersianNum(unit.area)}</td>
                <td>${toPersianNum(unit.occupants)}</td>
                <td><button class="danger" data-id="${unit.id}">حذف</button></td>
            `;
            unitsTableBody.appendChild(row);
        });
    };

    const renderPaymentUnitSelect = () => {
        paymentUnitSelect.innerHTML = '<option value="" disabled selected>انتخاب واحد</option>';
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = `واحد ${toPersianNum(unit.number)}`;
            paymentUnitSelect.appendChild(option);
        });
    };
    
    const renderReports = () => {
        debtorsTableBody.innerHTML = '';
        let totalIncome = 0;
        let totalExpense = 0;

        const balances = {};
        units.forEach(u => balances[u.id] = 0);
        
        transactions.forEach(t => {
            if(t.type === 'charge') balances[t.unitId] -= t.amount;
            if(t.type === 'payment') {
                balances[t.unitId] += t.amount;
                totalIncome += t.amount;
            }
            if(t.type === 'expense') totalExpense += t.amount;
        });
        
        for(const unitId in balances){
            if(balances[unitId] < 0){
                 const unit = units.find(u => u.id == unitId);
                 if(unit){
                     const row = document.createElement('tr');
                     row.innerHTML = `
                        <td>واحد ${toPersianNum(unit.number)}</td>
                        <td style="color: var(--danger-color);">${toPersianNum(Math.abs(balances[unitId]).toLocaleString())}</td>
                     `;
                     debtorsTableBody.appendChild(row);
                 }
            }
        }
        
        totalIncomeSpan.textContent = toPersianNum(totalIncome.toLocaleString());
        totalExpenseSpan.textContent = toPersianNum(totalExpense.toLocaleString());
        fundBalanceSpan.textContent = toPersianNum((totalIncome - totalExpense).toLocaleString());
    };

    const renderExpenses = () => {
        expensesTableBody.innerHTML = '';
        const expenseList = transactions.filter(t => t.type === 'expense');
        expenseList.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${expense.title}</td>
                <td>${toPersianNum(expense.amount.toLocaleString())}</td>
                <td>${toPersianNum(new Date(expense.date).toLocaleDateString('fa-IR'))}</td>
                <td><button class="danger" data-id="${expense.id}">حذف</button></td>
            `;
            expensesTableBody.appendChild(row);
        });
    };

    // --- Event Handlers ---
    unitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newUnit = {
            id: Date.now(),
            number: document.getElementById('unit-number').value,
            area: parseFloat(document.getElementById('unit-area').value),
            occupants: parseInt(document.getElementById('unit-occupants').value),
        };
        units.push(newUnit);
        DB.set('units', units);
        clearForm(unitForm);
        renderAll();
    });

    unitsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('danger')) {
            const unitId = parseInt(e.target.dataset.id);
            if(confirm('آیا از حذف این واحد و تمام تراکنش‌های مربوط به آن مطمئن هستید؟')){
                units = units.filter(u => u.id !== unitId);
                transactions = transactions.filter(t => t.unitId !== unitId);
                DB.set('units', units);
                DB.set('transactions', transactions);
                renderAll();
            }
        }
    });

    chargeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('charge-title').value;
        const method = document.getElementById('charge-method').value;
        const baseAmount = parseFloat(document.getElementById('charge-base-amount').value);
        
        if(!confirm(`آیا از اعلام شارژ با عنوان "${title}" برای همه واحدها مطمئن هستید؟`)) return;

        let totalArea = 0;
        let totalOccupants = 0;
        if(method === 'by_area') totalArea = units.reduce((sum, u) => sum + u.area, 0);
        if(method === 'by_occupants') totalOccupants = units.reduce((sum, u) => sum + u.occupants, 0);
        
        units.forEach(unit => {
            let chargeAmount = 0;
            switch(method){
                case 'equal': chargeAmount = baseAmount; break;
                case 'by_area': chargeAmount = (baseAmount / totalArea) * unit.area; break;
                case 'by_occupants': chargeAmount = (baseAmount / totalOccupants) * unit.occupants; break;
            }
            const newCharge = {
                id: Date.now() + unit.id,
                type: 'charge',
                unitId: unit.id,
                title: title,
                amount: Math.round(chargeAmount),
                date: new Date().toISOString()
            };
            transactions.push(newCharge);
        });

        DB.set('transactions', transactions);
        clearForm(chargeForm);
        renderAll();
    });

    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newPayment = {
            id: Date.now(),
            type: 'payment',
            unitId: parseInt(document.getElementById('payment-unit-select').value),
            amount: parseFloat(document.getElementById('payment-amount').value),
            date: document.getElementById('payment-date').value
        };
        transactions.push(newPayment);
        DB.set('transactions', transactions);
        clearForm(paymentForm);
        renderAll();
    });

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newExpense = {
            id: Date.now(),
            type: 'expense',
            title: document.getElementById('expense-title').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            date: document.getElementById('expense-date').value
        };
        transactions.push(newExpense);
        DB.set('transactions', transactions);
        clearForm(expenseForm);
        renderAll();
    });

    expensesTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('danger')) {
            const transactionId = parseInt(e.target.dataset.id);
             if(confirm('آیا از حذف این هزینه مطمئن هستید؟')){
                transactions = transactions.filter(t => t.id !== transactionId);
                DB.set('transactions', transactions);
                renderAll();
            }
        }
    });

    // --- Initial Load ---
    renderAll();
});
