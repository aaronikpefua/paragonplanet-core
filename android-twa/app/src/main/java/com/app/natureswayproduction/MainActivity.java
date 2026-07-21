package com.app.natureswayproduction;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomnavigation.BottomNavigationView;

public class MainActivity extends AppCompatActivity {
    public static final int SCREEN_FEED = R.id.navigation_feed;
    public static final int SCREEN_WATCH = R.id.navigation_watch;
    public static final int SCREEN_WALLET = R.id.navigation_wallet;
    public static final int SCREEN_PROFILE = R.id.navigation_profile;
    public static final int SCREEN_UPLOAD = R.id.navigation_upload;

    private BottomNavigationView bottomNavigationView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNavigationView = findViewById(R.id.bottom_navigation);
        bottomNavigationView.setOnItemSelectedListener(item -> {
            Fragment fragment = createFragmentForMenu(item.getItemId());
            if (fragment == null) return false;
            showFragment(fragment);
            return true;
        });

        if (savedInstanceState == null) {
            bottomNavigationView.setSelectedItemId(SCREEN_FEED);
        }
    }

    public void navigateToScreen(int itemId) {
        bottomNavigationView.setSelectedItemId(itemId);
    }

    private Fragment createFragmentForMenu(int itemId) {
        if (itemId == SCREEN_FEED) return new FeedFragment();
        if (itemId == SCREEN_WATCH) return WebAppFragment.newInstance("Watch", "/autoplay");
        if (itemId == SCREEN_WALLET) return new WalletFragment();
        if (itemId == SCREEN_PROFILE) return WebAppFragment.newInstance("Profile", "/profile");
        if (itemId == SCREEN_UPLOAD) return WebAppFragment.newInstance("Upload", "/upload");
        return null;
    }

    private void showFragment(@NonNull Fragment fragment) {
        getSupportFragmentManager().beginTransaction().replace(R.id.main_fragment_container, fragment).commit();
    }
}
