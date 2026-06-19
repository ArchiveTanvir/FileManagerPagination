<?php

use App\App;
use RateLimit\Rate;
use App\Helpers\ApiResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\RouteCollection;
use App\Addons\filemanagerpagination\Controllers\FilePaginationController;

return function (RouteCollection $routes): void {
    App::getInstance(true)->registerServerRoute(
        $routes,
        'filemanager-pagination-list',
        '/api/user/servers/{uuidShort}/files/paginated',
        function (Request $request, array $args) {
            $uuidShort = $args['uuidShort'] ?? null;
            if (!$uuidShort) {
                return ApiResponse::error('Missing UUID short', 'INVALID_UUID_SHORT', 400);
            }
            return (new FilePaginationController())->listFiles($request, $uuidShort);
        },
        'uuidShort',
        ['GET'],
        Rate::perMinute(120),
        'user-server-files'
    );

    App::getInstance(true)->registerApiRoute(
        $routes,
        'filemanager-pagination-config',
        '/api/public/filemanager-pagination/config',
        function (Request $request) {
            return (new FilePaginationController())->config();
        },
        ['GET']
    );

    App::getInstance(true)->registerApiRoute(
        $routes,
        'filemanager-pagination-version',
        '/api/public/filemanager-pagination/version',
        function (Request $request) {
            return (new FilePaginationController())->version();
        },
        ['GET']
    );
};
