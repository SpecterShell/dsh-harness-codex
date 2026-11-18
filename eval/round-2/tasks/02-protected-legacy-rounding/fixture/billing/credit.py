def credit_total(lines):
    total = 0.0
    for amount, quantity in lines:
        total += float(amount) * quantity
    return round(total, 2)
