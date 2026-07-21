package com.app.natureswayproduction;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.android.billingclient.api.ProductDetails;

import java.util.List;

public class WalletFragment extends Fragment {
    private NativeBillingManager billingManager;
    private TextView walletStatusText;
    private TextView debugText;
    private LinearLayout productContainer;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_wallet_native, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        billingManager = new NativeBillingManager(requireActivity());
        walletStatusText = view.findViewById(R.id.wallet_status_text);
        debugText = view.findViewById(R.id.debug_text);
        productContainer = view.findViewById(R.id.product_container);
        Button refreshButton = view.findViewById(R.id.refresh_products_button);
        Button webWalletButton = view.findViewById(R.id.open_web_wallet_button);
        refreshButton.setOnClickListener(v -> loadProducts());
        webWalletButton.setOnClickListener(v -> getParentFragmentManager().beginTransaction().replace(R.id.main_fragment_container, WebAppFragment.newInstance("Wallet", "/wallet?deposit=1")).commit());
        loadProducts();
    }

    private void loadProducts() {
        walletStatusText.setText(R.string.wallet_native_status_loading);
        debugText.setText("billingState: connecting");
        productContainer.removeAllViews();
        billingManager.queryWalletProducts(new NativeBillingManager.ProductListener() {
            @Override
            public void onProductsLoaded(List<ProductDetails> products, String diagnostics) {
                if (!isAdded()) return;
                debugText.setText(diagnostics);
                if (products == null || products.isEmpty()) {
                    walletStatusText.setText(R.string.wallet_native_status_empty);
                    return;
                }
                walletStatusText.setText(R.string.wallet_native_status_ready);
                for (ProductDetails product : products) addProductButton(product);
            }
            @Override
            public void onError(String diagnostics) {
                if (!isAdded()) return;
                walletStatusText.setText(R.string.wallet_native_status_error);
                debugText.setText(diagnostics);
            }
        });
    }

    private void addProductButton(ProductDetails product) {
        Button button = new Button(requireContext());
        String price = "";
        if (product.getOneTimePurchaseOfferDetails() != null) {
            price = product.getOneTimePurchaseOfferDetails().getFormattedPrice();
        }
        button.setText(product.getTitle() + (price.isEmpty() ? "" : " - " + price));
        button.setAllCaps(false);
        button.setOnClickListener(v -> {
            billingManager.launchPurchase(requireActivity(), product);
            Toast.makeText(requireContext(), "Launching Google Play Billing for " + product.getProductId(), Toast.LENGTH_SHORT).show();
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = 12;
        button.setLayoutParams(params);
        productContainer.addView(button);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (billingManager != null) {
            billingManager.destroy();
            billingManager = null;
        }
    }
}
