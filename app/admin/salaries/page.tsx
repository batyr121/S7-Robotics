"use client"
import { Coins, Filter, Download } from "lucide-react"

export default function AdminSalariesPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <Coins className="w-6 h-6" /> Зарплаты и выплаты
                </h1>
                <div className="flex gap-2">
                    <button className="btn bg-[var(--color-surface-2)] text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)]">
                        <Filter className="w-4 h-4 mr-2" /> Фильтр
                    </button>
                    <button className="btn bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]">
                        <Download className="w-4 h-4 mr-2" /> Экспорт
                    </button>
                </div>
            </div>

            <div className="card p-8 text-center bg-[var(--color-surface-1)] border-dashed border-2 border-[var(--color-border-1)]">
                <Coins className="w-12 h-12 mx-auto text-[var(--color-text-3)] mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-[var(--color-text-1)]">Раздел в разработке</h3>
                <p className="text-[var(--color-text-3)] mt-2">Функционал расчета зарплат будет доступен в следующем обновлении.</p>
            </div>
        </div>
    )
}
