import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mockDb } from '../services/mockDb';
import { InventoryItem } from '../types';
import { Camera, Archive, Loader2, Plus, Trash2, Minus, X } from 'lucide-react';
import { analyzeReceiptImage, ReceiptProductDraft } from '../services/groqVisionService';

interface InventoryProps {
  userId: string;
}

const parseQuantityInput = (value: string): number | 'm' | null => {
  const clean = value.trim().toLowerCase();

  if (clean === 'm') return 'm';

  const numeric = Number(clean);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const quarters = numeric * 4;
  if (!Number.isInteger(quarters)) return null;

  return numeric;
};

const createEmptyReceiptProduct = (): ReceiptProductDraft => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
  name: '',
  quantity: '1'
});

const Inventory: React.FC<InventoryProps> = ({ userId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingredientName, setIngredientName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [receiptProducts, setReceiptProducts] = useState<ReceiptProductDraft[]>([]);
  const [receiptError, setReceiptError] = useState('');
  const [isReceiptReviewOpen, setIsReceiptReviewOpen] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadInventory = async () => {
    setLoading(true);
    const data = await mockDb.inventory.list(userId);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadInventory();
  }, [userId]);

  const addOrUpdateItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedIngredient = ingredientName.trim();
    if (!normalizedIngredient) return;

    const parsedQuantity = parseQuantityInput(quantity);
    if (parsedQuantity === null) return;

    await mockDb.inventory.upsertByName(userId, normalizedIngredient, parsedQuantity);
    setIngredientName('');
    setQuantity('1');
    loadInventory();
  };

  const deleteItem = async (id: string) => {
    await mockDb.inventory.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const adjustItemQuantity = async (item: InventoryItem, delta: number) => {
    if (item.quantity === 'm') return;

    const nextQuantity = Number((item.quantity + delta).toFixed(2));
    if (nextQuantity <= 0) {
      await mockDb.inventory.delete(item.id);
      setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      return;
    }

    await mockDb.inventory.upsertByName(userId, item.ingredient_name, nextQuantity);
    setItems((prev) => prev.map((existing) =>
      existing.id === item.id ? { ...existing, quantity: nextQuantity } : existing
    ));
  };

  const openReceiptPicker = () => {
    setReceiptError('');
    fileInputRef.current?.click();
  };

  const handleReceiptImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReceiptError('Selecciona una imagen del ticket.');
      return;
    }

    setReceiptError('');
    setIsScanningReceipt(true);

    try {
      const detectedProducts = await analyzeReceiptImage(file);
      setReceiptProducts(detectedProducts.length > 0 ? detectedProducts : [createEmptyReceiptProduct()]);
      setIsReceiptReviewOpen(true);
      if (detectedProducts.length === 0) {
        setReceiptError('He leído el ticket, pero no he detectado productos claros. Puedes añadirlos manualmente abajo.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido leer el ticket.';
      setReceiptProducts([createEmptyReceiptProduct()]);
      setIsReceiptReviewOpen(true);
      setReceiptError(`${message} Puedes introducir los productos manualmente.`);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const updateReceiptProduct = (id: string, updates: Partial<Pick<ReceiptProductDraft, 'name' | 'quantity'>>) => {
    setReceiptProducts((prev) => prev.map((product) => (
      product.id === id ? { ...product, ...updates } : product
    )));
  };

  const removeReceiptProduct = (id: string) => {
    setReceiptProducts((prev) => prev.filter((product) => product.id !== id));
  };

  const addReceiptProductRow = () => {
    setReceiptProducts((prev) => [...prev, createEmptyReceiptProduct()]);
  };

  const closeReceiptReview = () => {
    setIsReceiptReviewOpen(false);
    setReceiptProducts([]);
    setReceiptError('');
  };

  const importReceiptProducts = async () => {
    const validProducts = receiptProducts
      .map((product) => ({
        name: product.name.trim(),
        quantity: parseQuantityInput(product.quantity)
      }))
      .filter((product): product is { name: string; quantity: number | 'm' } => (
        product.name.length > 0 && product.quantity !== null
      ));

    if (validProducts.length === 0) {
      setReceiptError('Añade al menos un producto válido antes de importar.');
      return;
    }

    for (const product of validProducts) {
      await mockDb.inventory.incrementByName(userId, product.name, product.quantity);
    }

    closeReceiptReview();
    loadInventory();
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name)),
    [items]
  );

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-orange-600" /></div>;

  const canSubmit = ingredientName.trim().length > 0 && parseQuantityInput(quantity) !== null;
  const canImportReceipt = receiptProducts.some((product) => product.name.trim().length > 0 && parseQuantityInput(product.quantity) !== null);

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Archive size={22} className="text-orange-600" />
          Inventario
        </h2>
        <p className="text-sm text-gray-500 mt-1">Ingredientes disponibles en nevera, congelador y despensa.</p>
      </div>

      <div className="px-4 mb-5">
        <form onSubmit={addOrUpdateItem} className="grid grid-cols-[minmax(0,1fr)_72px_40px] gap-2">
          <input
            type="text"
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            placeholder="Ingrediente"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
          />
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Cant./m"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-orange-600 text-white rounded-lg w-10 h-10 flex items-center justify-center hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </form>
      </div>

      {receiptError && !isReceiptReviewOpen && (
        <div className="mx-4 mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
          {receiptError}
        </div>
      )}

      <div className="px-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
          <span>Ingredientes</span>
          <span>Cantidad</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Aún no hay ingredientes en inventario.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 bg-white">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-gray-800 font-medium break-words">{item.ingredient_name}</span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-300 hover:text-red-500 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustItemQuantity(item, -1)}
                    disabled={item.quantity === 'm'}
                    className="w-7 h-7 rounded border border-gray-200 text-gray-600 flex items-center justify-center disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center text-gray-700 text-sm">{item.quantity}</span>
                  <button
                    onClick={() => adjustItemQuantity(item, 1)}
                    disabled={item.quantity === 'm'}
                    className="w-7 h-7 rounded border border-gray-200 text-gray-600 flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReceiptImageSelected}
        className="hidden"
      />

      <button
        type="button"
        onClick={openReceiptPicker}
        disabled={isScanningReceipt}
        className="fixed bottom-20 left-1/2 z-30 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg ring-4 ring-white hover:bg-orange-700 disabled:opacity-60"
        aria-label="Escanear ticket de compra"
      >
        {isScanningReceipt ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
      </button>

      {isScanningReceipt && (
        <div className="fixed bottom-36 left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-center text-sm text-gray-700 shadow-lg border border-gray-100">
          Analizando ticket...
        </div>
      )}

      {isReceiptReviewOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Revisar ticket</h3>
                <p className="text-sm text-gray-500">Corrige nombres y cantidades antes de importarlos.</p>
              </div>
              <button onClick={closeReceiptReview} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {receiptError && (
              <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                {receiptError}
              </div>
            )}

            <div className="space-y-2">
              {receiptProducts.map((product) => {
                const quantityIsValid = parseQuantityInput(product.quantity) !== null;
                return (
                  <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_74px_36px] gap-2">
                    <input
                      type="text"
                      value={product.name}
                      onChange={(event) => updateReceiptProduct(product.id, { name: event.target.value })}
                      placeholder="Producto"
                      className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="text"
                      value={product.quantity}
                      onChange={(event) => updateReceiptProduct(product.id, { quantity: event.target.value })}
                      placeholder="Cant."
                      className={`rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 ${quantityIsValid ? '' : 'border-red-300'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeReceiptProduct(product.id)}
                      className="flex h-10 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addReceiptProductRow}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              <Plus size={16} /> Añadir producto
            </button>



            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeReceiptReview}
                className="rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={importReceiptProducts}
                disabled={!canImportReceipt}
                className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
