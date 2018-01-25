const ApiService = require("services/ApiService");
const ModalService = require("services/ModalService");
const AddressFieldService = require("services/AddressFieldService");

import ValidationService from "services/ValidationService";

const ModalType = {
    INITIAL:    "initial",
    CREATE:     "create",
    UPDATE:     "update",
    DELETE:     "delete"
};

const AddressType = {
    INVOICE:    "1",
    SHIPPING:   "2"
};

const ModalHeadlineMap = {
    initial: {
        1: Translations.Template.orderInvoiceAddressInitial,
        2: Translations.Template.orderInvoiceAddressInitial
    },
    create: {
        1: Translations.Template.orderInvoiceAddressCreate,
        2: Translations.Template.orderShippingAddressCreate
    },
    update: {
        1: Translations.Template.orderInvoiceAddressEdit,
        2: Translations.Template.orderShippingAddressEdit
    },
    delete: {
        1: Translations.Template.orderInvoiceAddressDelete,
        2: Translations.Template.orderShippingAddressDelete
    }
};

Vue.component("address-select", {

    delimiters: ["${", "}"],

    props: [
        "template",
        "addressType",
        "showError",
        "countryNameMap"
    ],

    data()
    {
        return {
            addressModal   : {},
            modalType      : "",
            headline       : "",
            addressToEdit  : {},
            addressToDelete: {},
            deleteModal    : "",
            deleteModalWaiting: false,
            addressOptionTypeFieldMap:
            {
                1: "vatNumber",
                4: "telephone",
                9: "birthday",
                11: "title"
            }
        };
    },

    computed:
    {
        selectedAddress()
        {
            return this.$store.getters.getSelectedAddress(this.addressType);
        },

        addressList()
        {
            return this.$store.getters.getAddressList(this.addressType);
        },

        shippingCountryId()
        {
            return this.$store.state.localization.shippingCountryId;
        },

        isAddAddressEnabled()
        {
            if (this.addressType === AddressType.INVOICE)
            {
                return this.$store.getters.isLoggedIn || this.addressList.length < 1;
            }

            return this.$store.getters.isLoggedIn || this.addressList.length < 2;
        },

        isAddressListEmpty()
        {
            return !(this.addressList && this.addressList.length > 0);
        },

        ...Vuex.mapState({
            isBasketLoading: state => state.basket.isBasketLoading
        })
    },

    /**
     *  Check whether the address list is not empty and select the address with the matching ID
     */
    created()
    {
        this.$options.template = this.template;
        this.addEventListener();
    },

    /**
     * Select the address modal
     */
    mounted()
    {
        this.$nextTick(() =>
        {
            this.addressModal = ModalService.findModal(this.$refs.addressModal);
            this.deleteModal = ModalService.findModal(this.$refs.deleteModal);
        });
    },

    methods: {
        /**
         * Add the event listener
         */
        addEventListener()
        {
            ApiService.listen("AfterAccountContactLogout", () =>
            {
                this.$store.commit("resetAddress", this.addressType);
            });
        },

        /**
         * Update the selected address
         * @param index
         */
        onAddressChanged(address)
        {
            this.$emit("address-changed", address);
        },

        /**
         * Check whether a company name exists and show it in bold
         * @returns {boolean}
         */
        showNameStrong()
        {
            return !this.selectedAddress.name1 || this.selectedAddress.name1.length === 0;
        },

        /**
         * Show the add modal initially, if no address is selected in checkout
         */
        showInitialAddModal()
        {
            this.modalType = ModalType.INITIAL;

            if (AddressFieldService.isAddressFieldEnabled(this.addressToEdit.countryId, this.addressType, "salutation"))
            {
                this.addressToEdit = {
                    addressSalutation: 0,
                    countryId        : this.shippingCountryId
                };
            }
            else
            {
                this.addressToEdit = {countryId: this.shippingCountryId};
            }

            this.updateHeadline();
            this.addressModal.show();
        },

        /**
         * Show the add modal
         */
        showAddModal()
        {
            this.modalType = ModalType.CREATE;

            if (AddressFieldService.isAddressFieldEnabled(this.addressToEdit.countryId, this.addressType, "salutation"))
            {
                this.addressToEdit = {
                    addressSalutation: 0,
                    countryId        : this.shippingCountryId
                };
            }
            else
            {
                this.addressToEdit = {countryId: this.shippingCountryId};
            }

            this.updateHeadline();
            ValidationService.unmarkAllFields($(this.$refs.addressModal));
            this.addressModal.show();
        },

        /**
         * Show the edit modal
         * @param address
         */
        showEditModal(address)
        {
            this.modalType = ModalType.UPDATE;
            this.addressToEdit = this.getAddressToEdit(address);

            if (typeof this.addressToEdit.addressSalutation === "undefined")
            {
                this.addressToEdit.addressSalutation = 0;
            }

            this.updateHeadline();
            ValidationService.unmarkAllFields($(this.$refs.addressModal));
            this.addressModal.show();
        },

        getAddressToEdit(address)
        {
            // Creates a tmp address to prevent unwanted two-way binding
            const addressToEdit = JSON.parse(JSON.stringify(address));

            if (addressToEdit.options)
            {
                for (const option of addressToEdit.options)
                {
                    const optionName = this.addressOptionTypeFieldMap[option.typeId];

                    addressToEdit[optionName] = option.value || null;
                }
            }

            return addressToEdit;
        },

        /**
         * Show the delete modal
         * @param address
         */
        showDeleteModal(address)
        {
            this.modalType = ModalType.DELETE;
            this.addressToDelete = address;
            this.updateHeadline();
            this.deleteModal.show();
        },

        /**
         * Delete the address selected before
         */
        deleteAddress()
        {
            this.deleteModalWaiting = true;

            this.$store.dispatch("deleteAddress", {address: this.addressToDelete, addressType: this.addressType})
                .then(
                    response =>
                    {
                        this.closeDeleteModal();
                        this.deleteModalWaiting = false;
                    },
                    error =>
                    {
                        this.deleteModalWaiting = false;
                    }
                );
        },

        /**
         * Close the current create/update address modal
         */
        closeAddressModal()
        {
            this.addressModal.hide();
        },

        /**
         * Close the current delete address modal
         */
        closeDeleteModal()
        {
            this.deleteModal.hide();
        },

        /**
         * Dynamically create the header line in the modal
         */
        updateHeadline()
        {
            if (ModalHeadlineMap[this.modalType] && ModalHeadlineMap[this.modalType][this.addressType])
            {
                this.headline = ModalHeadlineMap[this.modalType][this.addressType];
            }
            else
            {
                this.headline = ModalHeadlineMap[ModalType.INITIAL][AddressType.INVOICE];
            }
        },

        /**
         * @param countryId
         * @returns country name | empty string
         */
        getCountryName(countryId)
        {
            if (countryId > 0)
            {
                return this.countryNameMap[countryId];
            }

            return "";
        },

        setAddressToEditField({field, value})
        {
            this.addressToEdit[field] = value;
        }
    },

    filters :
    {
        optionType(selectedAddress, typeId)
        {
            if (selectedAddress && selectedAddress.name2)
            {
                for (const optionType of selectedAddress.options)
                {
                    if (optionType.typeId === typeId)
                    {
                        return optionType.value;
                    }
                }
            }

            return "";

        }
    }
});
