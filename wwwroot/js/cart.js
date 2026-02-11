(function () {
    'use strict';

    // ============================================================================
    // GUARD: Prevent multiple initializations
    // ============================================================================
    if (window.cart) return;

    // ============================================================================
    // CONSTANTS
    // ============================================================================
    const STORAGE_KEY = 'htmxrazor_cart';
    const SELECTORS = {
        cartRoot: 'cart-root',
        cartCount: 'cart-count',
        content: 'content'
    };

    // ============================================================================
    // STORAGE LAYER
    // ============================================================================
    const Storage = {
        read() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        },

        write(items) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch (error) {
                console.error('Failed to write to localStorage:', error);
            }
        },

        clear() {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.error('Failed to clear localStorage:', error);
            }
        }
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    const Utils = {
        escapeHtml(text) {
            if (!text) return '';
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return String(text).replace(/[&<>"']/g, m => escapeMap[m]);
        },

        parseProduct(product) {
            if (typeof product === 'string') {
                try {
                    return JSON.parse(product);
                } catch {
                    return null;
                }
            }
            return product;
        },

        calculateTotal(items) {
            return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
        },

        totalQuantity(items) {
            return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        }
    };

    // ============================================================================
    // RENDERING LAYER
    // ============================================================================
    const Renderer = {
        renderCartItem(item) {
            const lineTotal = ((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2);
            return `
                <div class="cart-item" style="display:flex;align-items:center;margin:0.5rem 0;padding:0.5rem;background:#fff;border-radius:8px;">
                    <img src="${Utils.escapeHtml(item.thumbnail ?? '')}" 
                         alt="${Utils.escapeHtml(item.title)}" 
                         style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin-right:0.75rem;" />
                    <div style="flex:1;">
                        <div style="font-weight:600;">${Utils.escapeHtml(item.title)}</div>
                        <div style="color:#666;">€${Number(item.price).toFixed(2)} x <strong>${Number(item.quantity)}</strong> = €${lineTotal}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.25rem;">
                        <button onclick="window.cart.increment(${item.id})" 
                                style="background:#2ecc71;color:#fff;border:none;padding:0.35rem 0.6rem;border-radius:6px;cursor:pointer;">
                            +
                        </button>
                        <button onclick="window.cart.decrement(${item.id})" 
                                style="background:#f39c12;color:#fff;border:none;padding:0.35rem 0.6rem;border-radius:6px;cursor:pointer;">
                            -
                        </button>
                        <button onclick="window.cart.remove(${item.id})" 
                                style="background:#e74c3c;color:#fff;border:none;padding:0.35rem 0.6rem;border-radius:6px;cursor:pointer;">
                            Suppr
                        </button>
                    </div>
                </div>`;
        },

        renderEmptyCart() {
            return '<p>Votre panier est vide.</p>';
        },

        renderCart(items) {
            if (!items || items.length === 0) {
                return this.renderEmptyCart();
            }

            const itemsHtml = items.map(item => this.renderCartItem(item)).join('');
            const total = Utils.calculateTotal(items).toFixed(2);

            return `
                <div>
                    ${itemsHtml}
                    <div style="margin-top:0.75rem;font-weight:700;">Total: €${total}</div>
                </div>`;
        },

        updateDOM(elementId, html) {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = html;
            }
        },

        updateText(elementId, text) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = text;
            }
        }
    };

    // ============================================================================
    // CART BUSINESS LOGIC
    // ============================================================================
    const CartManager = {
        getItems() {
            return Storage.read();
        },

        findIndexById(id) {
            return this.getItems().findIndex(item => Number(item.id) === Number(id));
        },

        addItem(product) {
            const parsedProduct = Utils.parseProduct(product);
            if (!parsedProduct || parsedProduct.id == null) return;

            const items = this.getItems();
            const idx = items.findIndex(i => Number(i.id) === Number(parsedProduct.id));
            if (idx >= 0) {
                // increment quantity when product already exists
                items[idx].quantity = (Number(items[idx].quantity) || 0) + 1;
            } else {
                items.push({
                    id: parsedProduct.id,
                    title: parsedProduct.title,
                    price: parsedProduct.price,
                    thumbnail: parsedProduct.thumbnail,
                    quantity: 1
                });
            }

            this.saveItems(items);
        },

        // use when clicking the + button
        incrementItem(id) {
            try {
                const items = this.getItems();
                const idx = items.findIndex(i => Number(i.id) === Number(id));
                if (idx >= 0) {
                    items[idx].quantity = (Number(items[idx].quantity) || 0) + 1;
                    this.saveItems(items);
                }
            } catch (error) {
                console.error('incrementItem error:', error);
            }
        },

        // use when clicking the - button
        decrementItem(id) {
            try {
                const items = this.getItems();
                const idx = items.findIndex(i => Number(i.id) === Number(id));
                if (idx >= 0) {
                    items[idx].quantity = (Number(items[idx].quantity) || 0) - 1;
                    if (items[idx].quantity <= 0) {
                        items.splice(idx, 1);
                    }
                    this.saveItems(items);
                }
            } catch (error) {
                console.error('decrementItem error:', error);
            }
        },

        addFromElement(element) {
            try {
                if (!element?.dataset) return;

                const id = element.dataset.id ? Number(element.dataset.id) : undefined;
                const title = element.dataset.title ?? '';
                const price = element.dataset.price ? Number(element.dataset.price) : 0;
                const thumbnail = element.dataset.thumbnail ?? '';

                if (id === undefined || isNaN(id)) return;

                this.addItem({ id, title, price, thumbnail });
            } catch (error) {
                console.error('cart.addFromElement error:', error);
            }
        },

        removeItem(id) {
            try {
                const items = this.getItems().filter(item => Number(item.id) !== Number(id));
                this.saveItems(items);
            } catch (error) {
                console.error('removeItem error:', error);
            }
        },

        clearCart() {
            Storage.clear();
            this.refresh();
        },

        saveItems(items) {
            Storage.write(items);
            this.refresh();
        },

        refresh() {
            this.render();
            this.updateHeaderCount();
        },

        render() {
            const items = this.getItems();
            const html = Renderer.renderCart(items);
            Renderer.updateDOM(SELECTORS.cartRoot, html);
        },

        updateHeaderCount() {
            const items = this.getItems();
            const totalQty = Utils.totalQuantity(items);
            Renderer.updateText(SELECTORS.cartCount, totalQty.toString());
        },

        checkout() {
            alert('Passage à la caisse simulé. Implémenter le flux réel selon vos besoins.');
        }
    };

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    const EventHandlers = {
        onDOMContentLoaded() {
            CartManager.refresh();
        },

        onHtmxAfterSwap(event) {
            try {
                const target = event?.detail?.target;
                const shouldRefresh =
                    (target && target.id === SELECTORS.content) ||
                    document.getElementById(SELECTORS.cartRoot);

                if (shouldRefresh) {
                    setTimeout(() => CartManager.refresh(), 0);
                }
            } catch (error) {
                console.error('htmx afterSwap handler error:', error);
            }
        }
    };

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    const init = () => {
        // Expose public API
        window.cart = {
            add: (product) => CartManager.addItem(product),
            addFromElement: (element) => CartManager.addFromElement(element),
            increment: (id) => CartManager.incrementItem(id),
            decrement: (id) => CartManager.decrementItem(id),
            remove: (id) => CartManager.removeItem(id),
            clear: () => CartManager.clearCart(),
            render: () => CartManager.render(),
            updateHeaderCount: () => CartManager.updateHeaderCount(),
            checkout: () => CartManager.checkout()
        };

        // Register event listeners
        document.addEventListener('DOMContentLoaded', EventHandlers.onDOMContentLoaded);
        document.body.addEventListener('htmx:afterSwap', EventHandlers.onHtmxAfterSwap);

        // Initial render (in case script loads after DOM)
        CartManager.refresh();
    };

    // ============================================================================
    // START APPLICATION
    // ============================================================================
    init();

})();
