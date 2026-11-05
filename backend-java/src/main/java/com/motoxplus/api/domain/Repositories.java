package com.motoxplus.api.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Spring Data repositories for the entities in this package, grouped to keep it small. */
public final class Repositories {
    private Repositories() {}

    public interface UserRepository extends JpaRepository<User, String> {
        Optional<User> findByEmail(String email);

        Optional<User> findByMobileNumber(String mobileNumber);

        /** Atomic increment, same guarantee as Prisma's increment. */
        @Modifying
        @Transactional
        @Query("update User u set u.failedLoginAttempts = u.failedLoginAttempts + 1, u.updatedAt = :now where u.id = :id")
        int incrementFailedLogins(@Param("id") String id, @Param("now") LocalDateTime now);

        @Query("select u.failedLoginAttempts from User u where u.id = :id")
        Integer failedLoginAttempts(@Param("id") String id);

        @Modifying
        @Transactional
        @Query("update User u set u.accountLockedUntil = :until, u.updatedAt = :now where u.id = :id")
        int lockUntil(@Param("id") String id, @Param("until") LocalDateTime until, @Param("now") LocalDateTime now);

        @Modifying
        @Transactional
        @Query("update User u set u.failedLoginAttempts = 0, u.accountLockedUntil = null, u.updatedAt = :now where u.id = :id")
        int clearLockout(@Param("id") String id, @Param("now") LocalDateTime now);

        @Query("select u.accountLockedUntil from User u where u.id = :id")
        LocalDateTime lockedUntil(@Param("id") String id);

        @Modifying
        @Transactional
        @Query("update User u set u.lastLoginIP = :ip, u.lastDevice = :device, u.updatedAt = :now where u.id = :id")
        int recordLoginContext(@Param("id") String id, @Param("ip") String ip, @Param("device") String device, @Param("now") LocalDateTime now);

        @Modifying
        @Transactional
        @Query("update User u set u.lastLogin = :now where u.id = :id")
        int touchLastLogin(@Param("id") String id, @Param("now") LocalDateTime now);
    }

    public interface UserSessionRepository extends JpaRepository<UserSession, String> {
        Optional<UserSession> findByRefreshToken(String refreshToken);

        @Query("select s from UserSession s where s.userId = :userId and s.isActive = true and s.expiresAt > :now order by s.lastUsedAt desc")
        List<UserSession> findActive(@Param("userId") String userId, @Param("now") LocalDateTime now);

        @Modifying
        @Transactional
        @Query("update UserSession s set s.isActive = false where s.userId = :userId")
        int revokeAllForUser(@Param("userId") String userId);
    }

    public interface LoginHistoryRepository extends JpaRepository<LoginHistory, String> {}

    public interface DealerRepository extends JpaRepository<Dealer, String> {
        Optional<Dealer> findByUserId(String userId);
    }

    public interface VendorRepository extends JpaRepository<Vendor, String> {
        Optional<Vendor> findByUserId(String userId);
    }

    public interface AdminRepository extends JpaRepository<Admin, String> {
        Optional<Admin> findByUserId(String userId);
    }

    public interface CustomerRepository extends JpaRepository<Customer, String> {
        Optional<Customer> findByUserId(String userId);
    }
}
