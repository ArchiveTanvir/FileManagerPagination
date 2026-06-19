<?php

namespace App\Addons\filemanagerpagination\Controllers;

use App\Chat\Server;
use App\Chat\Node;
use App\Helpers\ApiResponse;
use App\Services\Wings\Wings;
use App\Plugins\PluginSettings;
use App\SubuserPermissions;
use App\Controllers\User\Server\CheckSubuserPermissionsTrait;
use App\Services\Wings\Exceptions\WingsConnectionException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class FilePaginationController
{
    use CheckSubuserPermissionsTrait;

    private const VERSION = '1.0.1';
    private const MAX_PER_PAGE = 500;
    private const MIN_PER_PAGE = 1;
    private const DEFAULT_PER_PAGE = 50;

    private static ?int $cachedPerPage = null;

    public function version(): Response
    {
        return ApiResponse::success([
            'version' => self::VERSION,
            'name' => 'FileManagerPagination',
            'target' => 'v2',
        ]);
    }

    public function listFiles(Request $request, string $serverUuid): Response
    {
        try {
            $user = $request->attributes->get('user');
            if (!$user) {
                return ApiResponse::error('User not authenticated', 'UNAUTHENTICATED', 401);
            }

            $server = Server::getServerByUuidShort($serverUuid);
            if (!$server) {
                return ApiResponse::error('Server not found', 'SERVER_NOT_FOUND', 404);
            }

            $node = Node::getNodeById($server['node_id']);
            if (!$node) {
                return ApiResponse::error('Node not found', 'NODE_NOT_FOUND', 404);
            }

            $permissionCheck = $this->checkPermission($request, $server, SubuserPermissions::FILE_READ);
            if ($permissionCheck !== null) {
                return $permissionCheck;
            }

            $path = $this->sanitizePath($request->query->get('path', '/'));
            $page = max(1, (int) $request->query->get('page', 1));
            $perPage = $this->resolvePerPage((int) $request->query->get('per_page', 0));

            $wings = Wings::fromNode($node, 30);
            $response = $wings->getServer()->listDirectory($server['uuid'], $path, true);

            if (!$response->isSuccessful()) {
                return $this->errorResponse($response);
            }

            $allFiles = $response->getData();
            if (!is_array($allFiles)) {
                $allFiles = [];
            }
            $total = count($allFiles);
            $totalPages = max(1, (int) ceil($total / $perPage));
            $page = min($page, $totalPages);
            $offset = ($page - 1) * $perPage;

            return ApiResponse::success([
                'contents' => array_values(array_slice($allFiles, $offset, $perPage)),
                'pagination' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => $totalPages,
                    'has_next' => $page < $totalPages,
                    'has_prev' => $page > 1,
                    'from' => $offset + 1,
                    'to' => min($offset + $perPage, $total),
                ],
                'directory' => $path,
            ]);
        } catch (WingsConnectionException $e) {
            return ApiResponse::error(
                'Wings Connection Unavailable. Please contact the support team.',
                'WINGS_CONNECTION_UNAVAILABLE',
                503
            );
        } catch (\Exception $e) {
            $code = $e->getCode();
            $msg = $e->getMessage();

            if ($code >= 400 && $code < 600) {
                return ApiResponse::error('Failed to fetch files: ' . $msg, 'WINGS_ERROR', $code);
            }

            return ApiResponse::error('Failed to fetch files: ' . $msg, 'INTERNAL_ERROR', $code ?: 500);
        }
    }

    public function config(): Response
    {
        $perPage = $this->readConfigSetting();
        return ApiResponse::success(['per_page' => $perPage ?? (string) self::DEFAULT_PER_PAGE]);
    }

    private function resolvePerPage(int $requested = 0): int
    {
        $configPerPage = $this->readConfigSetting();
        $perPage = $configPerPage !== null ? (int) $configPerPage : self::DEFAULT_PER_PAGE;
        if ($requested > 0) {
            $perPage = $requested;
        }
        return min(self::MAX_PER_PAGE, max(self::MIN_PER_PAGE, $perPage));
    }

    private function readConfigSetting(): ?string
    {
        if (self::$cachedPerPage !== null) {
            return self::$cachedPerPage;
        }
        try {
            self::$cachedPerPage = PluginSettings::getSetting('filemanagerpagination', 'per_page');
        } catch (\Exception $e) {
            self::$cachedPerPage = null;
        }
        return self::$cachedPerPage;
    }

    private function sanitizePath(?string $path): string
    {
        if ($path === null || $path === '') {
            return '/';
        }
        $path = '/' . trim(preg_replace('/\/+/', '/', $path), '/');
        return $path ?: '/';
    }

    private function errorResponse($response): Response
    {
        $error = $response->getError();
        $statusCode = $response->getStatusCode();

        return ApiResponse::error('Failed to fetch files: ' . $error, 'WINGS_ERROR', $statusCode ?: 500);
    }
}
