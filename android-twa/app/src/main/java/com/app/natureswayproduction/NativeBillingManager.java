package com.app.natureswayproduction;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class NativeBillingManager implements PurchasesUpdatedListener {
    public interface ProductListener {
        void onProductsLoaded(List<ProductDetails> products, String diagnostics);
        void onError(String diagnostics);
    }

    private final BillingClient billingClient;
    private ProductListener currentListener;
    private final List<String> walletProducts = Arrays.asList("parag_5", "gbazilo_1", "gbazilo_2", "gbazilo_5", "gbazilo_10");

    public NativeBillingManager(Activity activity) {
        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    public void queryWalletProducts(ProductListener listener) {
        currentListener = listener;
        if (billingClient.isReady()) { queryProductsInternal(); return; }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    queryProductsInternal();
                } else if (currentListener != null) {
                    currentListener.onError(buildDiagnostics("setup_failed", billingResult));
                }
            }
            @Override
            public void onBillingServiceDisconnected() {
                if (currentListener != null) currentListener.onError("serviceDisconnected: yes");
            }
        });
    }

    private void queryProductsInternal() {
        List<QueryProductDetailsParams.Product> queryProducts = new ArrayList<>();
        for (String productId : walletProducts) {
            queryProducts.add(QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(BillingClient.ProductType.INAPP).build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(queryProducts).build();
        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                if (currentListener != null) currentListener.onProductsLoaded(productDetailsList, buildDiagnostics("ready", billingResult) + "\nproductsReturned: " + productDetailsList.size());
            } else if (currentListener != null) {
                currentListener.onError(buildDiagnostics("query_failed", billingResult));
            }
        });
    }

    public void launchPurchase(Activity activity, ProductDetails productDetails) {
        if (productDetails == null) return;
        List<BillingFlowParams.ProductDetailsParams> detailsParams = new ArrayList<>();
        detailsParams.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(productDetails).build());
        BillingFlowParams flowParams = BillingFlowParams.newBuilder().setProductDetailsParamsList(detailsParams).build();
        billingClient.launchBillingFlow(activity, flowParams);
    }

    public void destroy() { billingClient.endConnection(); }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List purchases) {
        // Verification bridge comes in the next billing milestone.
    }

    private String buildDiagnostics(String state, BillingResult billingResult) {
        return "billingState: " + state + "\nresponseCode: " + billingResult.getResponseCode() + "\ndebugMessage: " + billingResult.getDebugMessage();
    }
}
