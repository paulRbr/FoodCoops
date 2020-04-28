/* Copyright (C) 2020-Today: Druidoo (<https://www.druidoo.io>)
   License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl). */
odoo.define('pos_order_wait_save.models', function (require) {
    "use strict";
    var screens = require('point_of_sale.screens');
    var pos_model = require('point_of_sale.models');
    var PaymentScreenWidget = screens.PaymentScreenWidget;
    var OrderSuper = pos_model.Order.prototype;
    pos_model.Order = pos_model.Order.extend({
        initialize: function (attributes, options) {
            OrderSuper.initialize.apply(this, arguments);
            this.is_save_order = false;
        },
        export_as_JSON: function () {
            var res = OrderSuper.export_as_JSON.apply(this, arguments);
            res.is_save_order = this.is_save_order;
            return res;
        },
        export_for_printing: function () {
            var res = OrderSuper.export_for_printing.apply(this, arguments);
            res.note = this.is_save_order;
            return res;
        },
    });
    pos_model.PosModel = pos_model.PosModel.extend({
        _flush_orders: function (orders, options) {
            var self = this;
            var new_timeout = self.config.order_timeout * 1000;
            options.timeout = new_timeout;
            this.set('synch', {state: 'connecting', pending: orders.length});
            return self._save_to_server(orders, options).done(function (server_ids) {
                var pending = self.db.get_orders().length;
                self.set('synch', {
                    state: pending ? 'connecting' : 'connected',
                    pending: pending,
                });
                return server_ids;
            }).fail( function (error, event) {
                var pending = self.db.get_orders().length;
                if (self.get('failed')) {
                    self.set('synch', {state: 'error', pending: pending});
                } else {
                    self.set('synch', {state: 'disconnected', pending: pending});
                }
            });
        },
    });

    PaymentScreenWidget.include({
        finalize_validation: function () {
            var self = this;
            var new_timeout = self.pos.config.order_timeout * 1000;
            var order = this.pos.get_order();
            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {
                this.pos.proxy.open_cashbox();
            }
            order.initialize_validation_date();
            order.finalized = true;
            if (order.is_to_invoice()) {
                var invoiced = this.pos.push_and_invoice_order(order);
                this.invoicing = true;
                invoiced.fail(this._handleFailedPushForInvoice.bind(this, order, false));
                invoiced.done( function () {
                    self.invoicing = false;
                    setTimeout(function(){
                        var pending = self.pos.db.get_orders().length;
                        if (pending) {
                            order.is_save_order = true;
                        }
                        self.gui.show_screen('receipt')
                    }, new_timeout);
                });
            } else {
                var done_order = this.pos.push_order(order);
                done_order.done( function () {
                    var pending = self.pos.db.get_orders().length;
                    if (pending) {
                        order.is_save_order = true;
                    }
                    self.gui.show_screen('receipt');
                });
            }
        },
    });

});
